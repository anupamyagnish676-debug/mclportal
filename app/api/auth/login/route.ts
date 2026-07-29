import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, recordLoginAttempt, formatRetryTime } from '@/lib/rate-limit'
import { logAudit, getClientIp } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

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

  // ── Feature 3: Login email notification (admin + finance only) ───────────
  if ((role === 'admin' || role === 'finance') && process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    try {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
      })
      const now = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
      const areaLabel = profile.area ? ` (${profile.area})` : ''
      await transporter.sendMail({
        from: `"MCL Security" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `🔐 New sign-in to your MCL account`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <div style="background:#166534;padding:24px 32px;color:#fff;">
              <h1 style="margin:0;font-size:18px;font-weight:bold;">New Sign-In Detected</h1>
              <p style="margin:6px 0 0;font-size:12px;opacity:0.8;">MCL Internship Portal Security Alert</p>
            </div>
            <div style="padding:32px;color:#374151;background:#fff;">
              <p style="margin-top:0;font-size:15px;">Dear <strong>${profile.full_name || email}</strong>,</p>
              <p style="font-size:14px;color:#374151;">A new sign-in was detected for your MCL Portal account.</p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
                <tr style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:10px 0;color:#6b7280;font-weight:bold;width:100px;">Time</td>
                  <td style="padding:10px 0;color:#111827;">${now} IST</td>
                </tr>
                <tr style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:10px 0;color:#6b7280;font-weight:bold;">Role</td>
                  <td style="padding:10px 0;color:#111827;">${role.charAt(0).toUpperCase() + role.slice(1)}${areaLabel}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#6b7280;font-weight:bold;">IP Address</td>
                  <td style="padding:10px 0;color:#111827;">${ip}</td>
                </tr>
              </table>
              <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e;">
                <strong>⚠️ If this wasn't you</strong>, contact your system administrator immediately and change your password.
              </div>
            </div>
            <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#6b7280;">
              This is an automated security notification from MCL Internship Portal. Do not reply.
            </div>
          </div>
        `,
      })
    } catch (err: any) {
      console.error('[LOGIN] Failed to send security email:', err.message)
    }
  }

  // ── MFA check for admin and finance ──────────────────────────────────────
  if (role === 'admin' || role === 'finance') {
    try {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
        const responseData = {
          role, redirect: dashboardUrl, requires_mfa: true,
          mfa_redirect: `/mfa-verify?next=${dashboardUrl}`,
          session: { access_token: data.session!.access_token, refresh_token: data.session!.refresh_token },
          session_nonce: sessionNonce,
        }
        const response = NextResponse.json(responseData)
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, { ...options, path: '/', httpOnly: false, secure: false, sameSite: 'lax' })
        })
        response.cookies.set('mcl-session', JSON.stringify({
          access_token: data.session!.access_token,
          refresh_token: data.session!.refresh_token,
        }), { path: '/', httpOnly: false, secure: false, sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7 })
        response.cookies.set('mcl-session-nonce', sessionNonce, {
          path: '/', httpOnly: false, secure: false, sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7,
        })
        return response
      }
    } catch { /* graceful degradation */ }
  }

  // ── Normal login response ─────────────────────────────────────────────────
  const responseData = {
    role,
    redirect: dashboardUrl,
    session: { access_token: data.session!.access_token, refresh_token: data.session!.refresh_token },
    session_nonce: sessionNonce,
  }

  const response = NextResponse.json(responseData)
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, { ...options, path: '/', httpOnly: false, secure: false, sameSite: 'lax' })
  })
  response.cookies.set('mcl-session', JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }), { path: '/', httpOnly: false, secure: false, sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7 })
  response.cookies.set('mcl-session-nonce', sessionNonce, {
    path: '/', httpOnly: false, secure: false, sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7,
  })

  return response
}
