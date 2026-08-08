import { NextRequest, NextResponse } from 'next/server'
import { verifyOTPHash } from '@/lib/otp'
import { logAudit, getClientIp } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()
    const ip = getClientIp(req)

    if (!email || !code || code.length !== 6) {
      return NextResponse.json({ error: 'Valid 6-digit OTP code and email are required' }, { status: 400 })
    }

    // Read mcl-otp-data cookie
    const otpCookie = req.cookies.get('mcl-otp-data')?.value
    if (!otpCookie) {
      return NextResponse.json({ error: 'No OTP session found. Please login again.' }, { status: 400 })
    }

    let parsedCookie: { email: string; hash: string; expiresAt: number; role: string; redirect: string }
    try {
      parsedCookie = JSON.parse(decodeURIComponent(otpCookie))
    } catch {
      return NextResponse.json({ error: 'Invalid OTP session cookie.' }, { status: 400 })
    }

    if (parsedCookie.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Email mismatch. Please login again.' }, { status: 400 })
    }

    // Verify HMAC hash and expiry
    const result = verifyOTPHash(email, code, parsedCookie.expiresAt, parsedCookie.hash)
    if (!result.valid) {
      await logAudit({
        userEmail: email,
        action: 'LOGIN_FAILED',
        details: { reason: 'Invalid Email OTP', ip },
        ip,
      })
      return NextResponse.json({ error: result.reason || 'Invalid OTP code' }, { status: 400 })
    }

    // OTP Verified! Log audit event
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role')
      .eq('email', email)
      .maybeSingle()

    await logAudit({
      userId: profile?.id,
      userEmail: email,
      role: parsedCookie.role || profile?.role,
      action: 'MFA_VERIFIED',
      details: { method: 'EMAIL_OTP', ip },
      ip,
    })

    // Clear mcl-otp-data cookie and confirm success
    const response = NextResponse.json({ success: true, redirect: parsedCookie.redirect || '/admin' })
    response.cookies.delete('mcl-otp-data')

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 })
  }
}
