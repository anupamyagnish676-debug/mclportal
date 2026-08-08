import { NextRequest, NextResponse } from 'next/server'
import { generate6DigitOTP, generateOTPHash, sendOTPEmail } from '@/lib/otp'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name, role')
      .eq('email', email)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const otpCode = generate6DigitOTP()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
    const hash = generateOTPHash(email, otpCode, expiresAt)

    const sent = await sendOTPEmail({
      email,
      fullName: profile.full_name,
      otpCode,
      role: profile.role,
    })

    if (!sent) {
      return NextResponse.json({ error: 'Failed to send OTP email. Check Gmail SMTP settings.' }, { status: 500 })
    }

    const dashboardUrl =
      profile.role === 'admin' ? '/admin' :
      profile.role === 'finance' ? '/finance' : '/student'

    const cookieData = encodeURIComponent(JSON.stringify({
      email,
      hash,
      expiresAt,
      role: profile.role,
      redirect: dashboardUrl,
    }))

    const response = NextResponse.json({ success: true, message: 'New OTP sent to your email.' })
    response.cookies.set('mcl-otp-data', cookieData, {
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
    })

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to resend OTP' }, { status: 500 })
  }
}
