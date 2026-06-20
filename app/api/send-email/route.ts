import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { type, to, studentName } = await req.json()

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ success: true, skipped: true, reason: 'GMAIL credentials not set' })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    })

    if (type === 'joining_letter') {
      await transporter.sendMail({
        from: `"MCL Internship Portal" <${process.env.GMAIL_USER}>`,
        to,
        subject: 'Internship Joining Letter — Mahanadi Coalfields Limited',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <div style="background: #166534; padding: 24px 32px; color: #fff;">
              <h2 style="margin: 0;">Mahanadi Coalfields Limited</h2>
              <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.8;">A Subsidiary of Coal India Limited</p>
            </div>
            <div style="padding: 32px; color: #374151;">
              <p>Dear <strong>${studentName}</strong>,</p>
              <p>We are pleased to inform you that your application for internship at <strong>Mahanadi Coalfields Limited</strong> has been <strong>approved</strong>.</p>
              <p>Your login credentials for the MCL Internship Portal will be provided by the training office of the concerned wing.</p>
              <br/>
              <p>Regards,<br/>Training & Development Department<br/>Mahanadi Coalfields Limited</p>
            </div>
          </div>
        `,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 200 })
  }
}
