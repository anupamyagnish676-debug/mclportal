import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { type, to, studentName } = await req.json()

  // If Resend isn't configured yet, don't fail the whole approval flow — just skip silently
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ success: true, skipped: true, reason: 'RESEND_API_KEY not set' })
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    if (type === 'joining_letter') {
      await resend.emails.send({
        from: 'MCL Internship Portal <onboarding@resend.dev>',
        to,
        subject: 'Internship Joining Letter — Mahanadi Coalfields Limited',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #166534;">Mahanadi Coalfields Limited</h2>
            <p>Dear ${studentName},</p>
            <p>We are pleased to inform you that your application for internship at <strong>Mahanadi Coalfields Limited</strong> has been <strong>approved</strong>.</p>
            <p>Your login credentials for the MCL Internship Portal will be provided by the training office of the concerned wing.</p>
            <br/>
            <p>Regards,<br/>Training & Development Department<br/>Mahanadi Coalfields Limited</p>
          </div>
        `,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    // Don't block the approval action even if email fails
    return NextResponse.json({ success: false, error: err.message }, { status: 200 })
  }
}
