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

    const { full_name, email, password, role, wing, start_date, end_date, roll_no, university, serial_no } = await req.json()

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
      .update({ 
        role, 
        wing: wing || null, 
        full_name,
        roll_no: roll_no || null,
        university: university || null
      })
      .eq('id', newUser.user.id)

    if (profileUpdateError) return NextResponse.json({ error: profileUpdateError.message }, { status: 400 })

    let nextSerialStr = '42'
    if (role === 'student' && start_date && end_date) {
      // Automatically calculate the next serial number
      const { data: existingInternships } = await adminClient
        .from('internships')
        .select('serial_no')

      let maxSerial = 41 // Start at 41 so the first student gets 42
      if (existingInternships && existingInternships.length > 0) {
        const serials = existingInternships
          .map(i => parseInt(i.serial_no || ''))
          .filter(val => !isNaN(val))
        if (serials.length > 0) {
          maxSerial = Math.max(...serials)
        }
      }
      const nextSerial = maxSerial + 1
      nextSerialStr = nextSerial.toString()

      const { error: internshipError } = await adminClient.from('internships').insert({
        student_id: newUser.user.id,
        start_date,
        end_date,
        is_active: true,
        serial_no: nextSerialStr
      })
      if (internshipError) return NextResponse.json({ error: internshipError.message }, { status: 400 })
    }

    // Send welcome email with login credentials for students, mentors, and employees
    if (role === 'student' || role === 'mentor' || role === 'employee') {
      try {
        if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
          const nodemailer = await import('nodemailer')
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_PASS,
            },
          })

          const isStudent = role === 'student'
          const subject = isStudent
            ? 'Internship Joining / Reporting Letter — Mahanadi Coalfields Limited'
            : `Welcome to MCL Portal — Login Credentials for ${role.charAt(0).toUpperCase() + role.slice(1)}`

          const htmlContent = isStudent
            ? `
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
                    ${roll_no ? `<tr>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Roll Number</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${roll_no}</td>
                    </tr>` : ''}
                    ${university ? `<tr style="background: #f0fdf4;">
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">University / College</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${university}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Internship Serial Number</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;"><strong>${nextSerialStr}</strong></td>
                    </tr>
                    <tr style="background: #f0fdf4;">
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Training Place</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600; color: #166534;">Talcher Area, MCL</td>
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
                    <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Please change your password after logging in for the first time.</p>
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
            `
            : `
              <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <div style="background: #166534; padding: 24px 32px;">
                  <h1 style="color: #fff; margin: 0; font-size: 20px;">Mahanadi Coalfields Limited</h1>
                  <p style="color: #bbf7d0; margin: 4px 0 0; font-size: 13px;">A Subsidiary of Coal India Limited</p>
                </div>
                <div style="padding: 32px;">
                  <h2 style="color: #166534; margin-top: 0;">Portal Access Credentials</h2>
                  <p>Dear <strong>${full_name}</strong>,</p>
                  <p>You have been registered as a **${role.charAt(0).toUpperCase() + role.slice(1)}** on the <strong>Mahanadi Coalfields Limited Internship Portal</strong>.</p>
                  <p>Below are your credentials to log in and access your dashboard:</p>

                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="background: #f0fdf4;">
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600; width: 40%;">Name</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${full_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Assigned Role</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; text-transform: capitalize;">${role}</td>
                    </tr>
                    ${wing ? `<tr style="background: #f0fdf4;">
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Wing / Department</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${wing}</td>
                    </tr>` : ''}
                  </table>

                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 8px; font-weight: 600; color: #374151;">Portal Login Credentials</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Password:</strong> ${password}</p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Please change your password after logging in for the first time.</p>
                  </div>

                  <p>You can access the portal via the organization's server URL.</p>
                  <p>Thank you for your service and dedication.</p>

                  <br/>
                  <p style="margin: 0;">Regards,</p>
                  <p style="margin: 4px 0;"><strong>Training & Development Department</strong></p>
                  <p style="margin: 4px 0; color: #6b7280;">Mahanadi Coalfields Limited</p>
                </div>
                <div style="background: #f9fafb; padding: 12px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #9ca3af;">This is an automated email from the MCL Internship Portal. Please do not reply.</p>
                </div>
              </div>
            `

          await transporter.sendMail({
            from: `"MCL Internship Portal" <${process.env.GMAIL_USER}>`,
            to: email,
            subject,
            html: htmlContent,
          })
          console.log(`[CREATE-USER] Credentials sent via Gmail SMTP to ${email} (${role})`)
        } else {
          console.log(`[CREATE-USER] GMAIL credentials not set — skipping email for ${email}`)
        }
      } catch (emailErr: any) {
        console.error(`[CREATE-USER] Gmail SMTP failed for ${email}:`, emailErr.message)
      }
    }

    return NextResponse.json({ success: true, userId: newUser.user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
