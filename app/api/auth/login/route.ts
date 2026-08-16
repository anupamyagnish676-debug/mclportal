import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, recordLoginAttempt, formatRetryTime } from '@/lib/rate-limit'
import { logAudit, getClientIp } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'
import { generate6DigitOTP, generateOTPHash, sendOTPEmail } from '@/lib/otp'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()
  const ip = getClientIp(request)

  // ── Feature 1: Rate Limit Check ──────────────────────────────────────────
  const rateLimit = await checkRateLimit(email, ip)
  if (rateLimit.blocked) {
    await logAudit({
      userEmail: email,
      action: 'LOGIN_BLOCKED',
      details: { retryAfterSeconds: rateLimit.retryAfterSeconds, ip },
      ip,
    })
    return NextResponse.json(
      {
        error: `Too many failed login attempts. Please wait ${formatRetryTime(rateLimit.retryAfterSeconds!)} before trying again.`,
        blocked: true,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      { status: 429 }
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const cookiesToSet: Array<{ name: string; value: string; options: any }> = []

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => cookiesToSet.push({ name, value, options }))
      },
    },
  })

  // Sign in
  const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  // ── Feature 1: Record failed attempt ─────────────────────────────────────
  if (signInError) {
    await recordLoginAttempt(email, ip, false)
    await logAudit({
      userEmail: email,
      action: 'LOGIN_FAILED',
      details: { reason: signInError.message, ip, failureCount: (rateLimit.failureCount || 0) + 1 },
      ip,
    })
    return NextResponse.json({ error: signInError.message }, { status: 401 })
  }

  if (!data.user || !data.session) {
    return NextResponse.json({ error: 'No session returned.' }, { status: 401 })
  }

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name, area')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: `Profile error: ${profileError.message}` }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'No profile found. Contact admin.' }, { status: 404 })

  const role = profile.role
  const dashboardUrl =
    role === 'admin' ? '/admin' :
    role === 'mentor' ? '/mentor' :
    role === 'employee' ? '/employee' :
    role === 'finance' ? '/finance' : '/student'

  // ── Feature 1: Record successful attempt ─────────────────────────────────
  await recordLoginAttempt(email, ip, true)

  // ── Feature 8: Single session — generate new nonce, invalidate old ones ──
  const sessionNonce = crypto.randomBytes(24).toString('hex')
  try {
    const adminClient = createAdminClient()
    await adminClient
      .from('profiles')
      .update({ session_nonce: sessionNonce })
      .eq('id', data.user.id)
  } catch {
    // Non-critical — continue login
  }

  // ── Feature 2: Audit log ─────────────────────────────────────────────────
  await logAudit({
    userId: data.user.id,
    userEmail: email,
    role,
    action: 'LOGIN',
    details: { area: profile.area || null, ip },
    ip,
  })



  // Check if user has enrolled and verified a 2FA TOTP factor in Settings
  let hasUserEnabled2FA = false
  try {
    const { data: factorsData } = await adminClient.auth.admin.mfa.listFactors({ userId: data.user.id })
    const verifiedFactors = (factorsData?.factors || []).filter((f: any) => f.status === 'verified')
    hasUserEnabled2FA = verifiedFactors.length > 0
  } catch (err: any) {
    console.warn('[LOGIN] MFA factor list check warning:', err?.message)
  }

  const ENABLE_2FA = process.env.ENABLE_2FA === 'true' || hasUserEnabled2FA

  if (!ENABLE_2FA) {
    // Direct instant login without 2FA OTP requirement
    const responseData = {
      role,
      redirect: dashboardUrl,
      requires_mfa: false,
      email,
      session: { access_token: data.session!.access_token, refresh_token: data.session!.refresh_token },
      session_nonce: sessionNonce,
    }

    const response = NextResponse.json(responseData)
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, { ...options, path: '/', httpOnly: false, secure: false, sameSite: 'lax' })
    })

    // Set mcl-email-mfa-verified cookie to true so middleware allows immediate access
    response.cookies.set('mcl-email-mfa-verified', 'true', {
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    })

    return response
  }

  // ── Email OTP check for ALL user roles when ENABLE_2FA=true ──
  const otpCode = generate6DigitOTP()
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
  const hash = generateOTPHash(email, otpCode, expiresAt)

  // Send Email OTP via Nodemailer
  await sendOTPEmail({
    email,
    fullName: profile.full_name,
    otpCode,
    role,
  })

  const cookieData = encodeURIComponent(JSON.stringify({
    email,
    hash,
    expiresAt,
    role,
    redirect: dashboardUrl,
  }))

  const responseData = {
    role,
    redirect: dashboardUrl,
    requires_mfa: true,
    mfa_type: 'email',
    mfa_redirect: `/mfa-verify?email=${encodeURIComponent(email)}&next=${dashboardUrl}`,
    email,
    session: { access_token: data.session!.access_token, refresh_token: data.session!.refresh_token },
    session_nonce: sessionNonce,
  }

  const response = NextResponse.json(responseData)
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, { ...options, path: '/', httpOnly: false, secure: false, sameSite: 'lax' })
  })

  // Store temporary OTP session cookie
  response.cookies.set('mcl-otp-data', cookieData, {
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 5, // 5 minutes
  })

  // Store standard session cookies so user is authenticated upon OTP verification
  response.cookies.set('mcl-session', JSON.stringify({
    access_token: data.session!.access_token,
    refresh_token: data.session!.refresh_token,
  }), { path: '/', httpOnly: false, secure: false, sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7 })
  response.cookies.set('mcl-session-nonce', sessionNonce, {
    path: '/', httpOnly: false, secure: false, sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7,
  })

  return response
}
