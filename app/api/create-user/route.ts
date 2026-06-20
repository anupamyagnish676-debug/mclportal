import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    const { full_name, email, password, role, wing, start_date, end_date } = await req.json()

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })

    // The trigger auto-creates a profile row with role='student' default — update it to the real role
    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({ role, wing: wing || null, full_name })
      .eq('id', newUser.user.id)

    if (profileUpdateError) return NextResponse.json({ error: profileUpdateError.message }, { status: 400 })

    if (role === 'student' && start_date && end_date) {
      const { error: internshipError } = await adminClient.from('internships').insert({
        student_id: newUser.user.id,
        start_date,
        end_date,
        is_active: true,
      })
      if (internshipError) return NextResponse.json({ error: internshipError.message }, { status: 400 })
    }

    // Send joining/reporting letter email for students
    if (role === 'student') {
      try {
        if (process.env.RESEND_API_KEY) {
          const { Resend } = await import('resend')
          const resend = new Resend(process.env.RESEND_API_KEY)

          await resend.emails.send({
            from: 'MCL Internship Portal <onboarding@resend.dev>',
            to: email,
            subject: 'Internship Joining / Reporting Letter — Mahanadi Coalfields Limited',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <div style="background: #166534; padding: 24px 32px;">
                  <h1 style="color: #fff; margin: 0; font-size: 20px;">Mahanadi Coalfields Limited</h1>
                  <p style="color: #bbf7d0; margin: 4px 0 0; font-size: 13px;">A Subsidiary of Coal India Limited</p>
                </div>
                <div style="padding: 32px;">
                  <h2 style="color: #166534; margin-top: 0;">Internship Joining / Reporting Letter</h2>
                  <p>Dear <strong>${full_name}</strong>,</p>
                  <p>We are pleased to inform you that you have been registered for an internship at <strong>Mahanadi Coalfields Limited</strong>.</p>

                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="background: #f0fdf4;">
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600; width: 40%;">Name</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${full_name}</td>
                    </tr>
                    ${wing ? `<tr>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Wing / Department</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${wing}</td>
                    </tr>` : ''}
                    ${start_date ? `<tr style="background: #f0fdf4;">
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Internship Start Date</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${start_date}</td>
                    </tr>` : ''}
                    ${end_date ? `<tr>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Internship End Date</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${end_date}</td>
                    </tr>` : ''}
                  </table>

                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 8px; font-weight: 600; color: #374151;">Portal Login Credentials</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Password:</strong> ${password}</p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Please change your password after first login.</p>
                  </div>

                  <p>You are requested to report to the training office of the concerned wing on your start date.</p>
                  <p>We wish you a productive and enriching internship experience.</p>

                  <br/>
                  <p style="margin: 0;">Regards,</p>
                  <p style="margin: 4px 0;"><strong>Training & Development Department</strong></p>
                  <p style="margin: 4px 0; color: #6b7280;">Mahanadi Coalfields Limited</p>
                </div>
                <div style="background: #f9fafb; padding: 12px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #9ca3af;">This is an automated email from the MCL Internship Portal. Please do not reply.</p>
                </div>
              </div>
            `,
          })
          console.log(`[CREATE-USER] Joining letter sent to ${email}`)
        } else {
          console.log(`[CREATE-USER] RESEND_API_KEY not set — skipping email for ${email}`)
        }
      } catch (emailErr: any) {
        // Don't fail user creation if email fails
        console.error(`[CREATE-USER] Email failed for ${email}:`, emailErr.message)
      }
    }

    return NextResponse.json({ success: true, userId: newUser.user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
