import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserTOTPSecret, generateGoogleAuthQRCode } from '@/lib/totp'

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'Email query parameter is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    const userId = profile?.id || email
    const secret = getUserTOTPSecret(userId)
    const qrCodeUrl = await generateGoogleAuthQRCode(email, secret)

    return NextResponse.json({ secret, qrCodeUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate TOTP secret' }, { status: 500 })
  }
}
