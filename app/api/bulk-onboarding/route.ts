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

    const { students, defaultArea } = await req.json()
    if (!Array.isArray(students) || !students.length) {
      return NextResponse.json({ error: 'Invalid or empty students array' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const results: any[] = []

    // Cache existing internships to compute serial numbers cleanly
    const { data: existingInternships } = await adminClient
      .from('internships')
      .select('serial_no')

    let maxSerial = 41 // Default start at 41 so first gets 42
    if (existingInternships && existingInternships.length > 0) {
      const serials = existingInternships
        .map(i => parseInt(i.serial_no || ''))
        .filter(val => !isNaN(val))
      if (serials.length > 0) {
        maxSerial = Math.max(...serials)
      }
    }

    let currentSerial = maxSerial

    for (const student of students) {
      const { full_name, email, password, wing, start_date, end_date, roll_no, university, area: studentArea, internship_type } = student
      const area = studentArea || defaultArea || null

      if (!email || !password || !full_name) {
        results.push({ email: email || 'N/A', success: false, error: 'Missing required fields (email, password, full_name)' })
        continue
      }

      try {
        // 1. Create auth user
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, role: 'student' },
        })

        if (createError) {
          results.push({ email, success: false, error: createError.message })
          continue
        }

        // 2. Update profile
        const { error: profileUpdateError } = await adminClient
          .from('profiles')
          .update({ 
            role: 'student', 
            wing: wing || null, 
            full_name,
            roll_no: roll_no || null,
            university: university || null,
            area: area
          })
          .eq('id', newUser.user.id)

        if (profileUpdateError) {
          results.push({ email, success: false, error: `Profile update failed: ${profileUpdateError.message}` })
          continue
        }

        // 3. Create internship with serial number
        currentSerial += 1
        const serialStr = currentSerial.toString()

        const { error: internshipError } = await adminClient.from('internships').insert({
          student_id: newUser.user.id,
          start_date: start_date || null,
          end_date: end_date || null,
          is_active: true,
          serial_no: serialStr,
          area: area,
          internship_type: (internship_type || 'unpaid').toLowerCase().trim()
        })

        if (internshipError) {
          results.push({ email, success: false, error: `Internship row creation failed: ${internshipError.message}` })
          continue
        }

        // 4. Send credentials and reporting details via Email
        if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
          try {
            const nodemailer = await import('nodemailer')
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
              },
            })

            const siteBase = process.env.NEXT_PUBLIC_SITE_URL || (() => {
              const host = req.headers.get('host') || 'mcl-internship-portal-hp9qt2mhb-anupamyagnish676-4942s-projects.vercel.app'
              const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
              return `${protocol}://${host}`
            })()
const portalUrl = `${siteBase}/login`
            const isPaidIntern = (internship_type || 'unpaid').toLowerCase().trim() === 'paid'

            const htmlContent = `
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
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;"><strong>${serialStr}</strong></td>
                    </tr>
                    <tr style="background: #f0fdf4;">
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600; width: 40%;">Internship Type</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600; color: ${isPaidIntern ? '#166534' : '#374151'};">${isPaidIntern ? '✅ Paid Internship (Stipend Eligible)' : 'Unpaid Internship'}</td>
                    </tr>
                    <tr style="background: #f0fdf4;">
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600; width: 40%;">Training Place</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600; color: #166534;">${area || 'General'} Area, MCL</td>
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
                    <p style="margin: 8px 0 0; font-size: 14px;"><strong>Portal Link:</strong> <a href="${portalUrl}" style="color: #166534; text-decoration: underline; font-weight: 600;">Click here to access the Portal</a></p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Please change your password after logging in for the first time.</p>
                  </div>

                  ${isPaidIntern ? `
                  <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 10px; padding: 18px 20px; margin: 24px 0; font-family: Arial, sans-serif;">
                    <p style="margin: 0 0 10px; font-weight: 700; color: #92400e; font-size: 15px;">&#9888; Action Required - Paid Internship Stipend Onboarding</p>
                    <p style="margin: 0 0 12px; font-size: 13px; color: #78350f;">
                      You have been registered as a <strong>Paid Intern</strong> at Mahanadi Coalfields Limited and are eligible for monthly stipend. 
                      To enable stipend disbursement, you must complete the following steps immediately after logging in to the portal:
                    </p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                      <tr style="background: #fef3c7;">
                        <td style="padding: 10px 14px; border: 1px solid #fcd34d; font-weight: 700; width: 20%; color: #78350f;">Step 1</td>
                        <td style="padding: 10px 14px; border: 1px solid #fcd34d; color: #374151;">
                          Go to <strong>"Upload Docs"</strong> section in your dashboard and upload the required identity/onboarding documents 
                          (e.g., Aadhar Card, College ID, Undertaking Letter, etc.)
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 14px; border: 1px solid #fcd34d; font-weight: 700; color: #78350f;">Step 2</td>
                        <td style="padding: 10px 14px; border: 1px solid #fcd34d; color: #374151;">
                          Go to <strong>"My Stipend"</strong> section in your dashboard and submit your bank account details 
                          (Bank Name, Account Number, IFSC Code, Cancelled Cheque / Passbook copy) for Finance Department verification.
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 12px 0 0; font-size: 12px; color: #92400e;">
                      &#9203; <strong>Stipend payments will only be processed after both steps are completed and verified by the Finance Department.</strong>
                      Please complete this at the earliest to avoid delays.
                    </p>
                  </div>
                  ` : ''}

                  <p>You are requested to report to the training office of the concerned wing at <strong>${area || 'Talcher'} Area</strong> on your start date.</p>
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

            await transporter.sendMail({
              from: `"MCL Internship Portal" <${process.env.GMAIL_USER}>`,
              to: email,
              subject: 'Internship Joining / Reporting Letter — Mahanadi Coalfields Limited',
              html: htmlContent
            })
          } catch (mailErr: any) {
            console.error(`Bulk onboarding: Failed to send email to ${email}:`, mailErr.message)
          }
        }

        results.push({ email, success: true, serial_no: serialStr })
      } catch (err: any) {
        results.push({ email, success: false, error: err.message || 'Unknown error occurred' })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
