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

    const { full_name, email, password, role, wing, start_date, end_date, roll_no, university, serial_no, area, employee_code } = await req.json()

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

    // Update profile (which is auto-created by the Supabase auth trigger)
    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({ 
        role, 
        wing: wing || null, 
        full_name,
        roll_no: roll_no || null,
        university: university || null,
        area: area || null,
        employee_code: role === 'employee' ? employee_code || null : null
      })
      .eq('id', newUser.user.id)

    if (profileUpdateError) return NextResponse.json({ error: profileUpdateError.message }, { status: 400 })

    if (role === 'student') {
      // Link any approved application with this email to the new student ID
      await adminClient
        .from('applications')
        .update({ student_id: newUser.user.id })
        .eq('student_email', email.toLowerCase().trim())
        .eq('status', 'approved')
    }

    let nextSerialStr = '1'
    if (role === 'student' && start_date && end_date) {
      // Automatically calculate the next serial number
      const { data: existingInternships } = await adminClient
        .from('internships')
        .select('serial_no')

      let maxSerial = 0 // Start at 0 so the first student gets 1
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
        serial_no: nextSerialStr,
        area: area || null
      })
      if (internshipError) return NextResponse.json({ error: internshipError.message }, { status: 400 })
    }

    // Send welcome email with login credentials for students, mentors, employees, admins, and finance
    if (role === 'student' || role === 'mentor' || role === 'employee' || role === 'admin' || role === 'finance') {
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
                    <p style="margin: 8px 0 0; font-size: 14px;"><strong>Portal Link:</strong> <a href="https://mclportal-anupamyagnish676-4942s-projects.vercel.app" style="color: #166534; text-decoration: underline; font-weight: 600;">Click here to access the Portal</a></p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Please change your password after logging in for the first time.</p>
                  </div>

                  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                  
                  <h3 style="color: #166534; margin-top: 0; font-size: 15px;">प्रशिक्षण नियम एवं शर्तें / Training Terms & Conditions:</h3>
                  <ol style="padding-left: 20px; font-size: 13px; color: #4b5563; line-height: 1.6; margin: 15px 0;">
                    <li style="margin-bottom: 8px;">
                      <strong>छातर द्वारा एकत्रित की गई जानकारी का उपयोग केवल शैक्षणिक उद्देश्य के लिए किया जाएगा।</strong><br/>
                      <span style="color: #6b7280;">The information collected by the student will be used only for educational purpose.</span>
                    </li>
                    <li style="margin-bottom: 8px;">
                      <strong>प्रशिक्षण अवधि के दौरान छात्र को हुई किसी भी चोट/दुर्घटना के लिए कंपनी जिम्मेदार नहीं होगी।</strong><br/>
                      <span style="color: #6b7280;">The Company will not be responsible for any injury/accident caused to the student during the training period.</span>
                    </li>
                    <li style="margin-bottom: 8px;">
                      <strong>कंपनी द्वारा छात्र को कोई आवास और परिवहन प्रदान नहीं किया जाएगा।</strong><br/>
                      <span style="color: #6b7280;">No accommodation and transportation will be provided to the student by the company.</span>
                    </li>
                    <li style="margin-bottom: 8px;">
                      <strong>प्रशिक्षण उनके अपने जोखिम पर होगा, यदि उनकी प्रशिक्षण अवधि के दौरान कुछ होता है, तो कंपनी जिम्मेदार नहीं होगी। छात्रा को इस आशय का एक वचन पत्र प्रस्तुत करना होगा।</strong><br/>
                      <span style="color: #6b7280;">The training will be at their own risk, if anything happens during their training period, the company will not be responsible. The student must submit an undertaking to this effect.</span>
                    </li>
                    <li style="margin-bottom: 8px;">
                      <strong>एमसीएल द्वारा कोई वित्तीय भार वहन नहीं किया जाएगा।</strong><br/>
                      <span style="color: #6b7280;">No financial burden will be borne by MCL.</span>
                    </li>
                    <li style="margin-bottom: 8px;">
                      <strong>संबंधित क्षेत्र/परियोजना/विभाग द्वारा लगाई गई कोई अन्य शर्तें।</strong><br/>
                      <span style="color: #6b7280;">Any other conditions imposed by the concerned sector/project/department.</span>
                    </li>
                    <li style="margin-bottom: 8px;">
                      <strong>छात्र को सलाह दी जाती है कि वह इस ईमेल का प्रिंटआउट लें और रिपोर्ट करें।</strong><br/>
                      <span style="color: #6b7280;">The Student is advised to take a printout of this mail and report.</span>
                    </li>
                  </ol>

                  <div style="font-size: 13px; color: #374151; line-height: 1.6; background: #fdf2f8; border: 1px solid #fbcfe8; padding: 12px; border-radius: 8px; margin: 20px 0;">
                    <strong>आपसे अनुरोध है कि उपरोक्त छात्रा को आगे की आवश्यक कार्रवाई के लिए अपने पहचान पत्र के साथ General Manager, ${area ? `${area} Area` : 'Respective Area'}, MCL को उपरोक्त तिथि के अनुसार रिपोर्ट करने की सलाह दें।</strong><br/>
                    <span style="color: #4b5563;">You are requested to advise the above students to report to the General Manager, ${area ? `${area} Area` : 'Respective Area'}, MCL as per the above date along with his identity card for further necessary action.</span>
                  </div>

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
                    ${area ? `<tr style="background: #f0fdf4;">
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Office / Area Location</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${area} Area</td>
                    </tr>` : ''}
                    ${employee_code ? `<tr>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Employee Code</td>
                      <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${employee_code}</td>
                    </tr>` : ''}
                  </table>

                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 8px; font-weight: 600; color: #374151;">Portal Login Credentials</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Password:</strong> ${password}</p>
                    <p style="margin: 8px 0 0; font-size: 14px;"><strong>Portal Link:</strong> <a href="https://mclportal-anupamyagnish676-4942s-projects.vercel.app" style="color: #166534; text-decoration: underline; font-weight: 600;">Click here to access the Portal</a></p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Please change your password after logging in for the first time.</p>
                  </div>

                  <p>You can access the portal via: <a href="https://mclportal-anupamyagnish676-4942s-projects.vercel.app" style="color: #166534; text-decoration: underline; font-weight: 600;">https://mclportal-anupamyagnish676-4942s-projects.vercel.app</a></p>
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
