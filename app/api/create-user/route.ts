import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// Helper function to generate the 2-page MCL Joining Letter PDF
async function generateJoiningLetterPDF(data: {
  fullName: string
  rollNo: string
  university: string
  wing: string
  startDate: string
  endDate: string
  serialNo: string
}) {
  const pdfDoc = await PDFDocument.create()
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const currentDate = new Date().toLocaleDateString('en-GB')

  // --- PAGE 1 ---
  const page1 = pdfDoc.addPage([595, 842]) // A4 size
  const { width: w1, height: h1 } = page1.getSize()

  // Header Title
  page1.drawText('MAHANADI COALFIELDS LIMITED', { x: 140, y: h1 - 60, size: 18, font: boldFont, color: rgb(0.09, 0.53, 0.27) })
  page1.drawText('(A Subsidiary of Coal India Limited)', { x: 195, y: h1 - 78, size: 11, font: regularFont, color: rgb(0.3, 0.3, 0.3) })
  
  page1.drawText('Office of the General Manager (HRD)', { x: 190, y: h1 - 105, size: 10, font: boldFont })
  page1.drawText('Human Resource Development Department, Jagriti Vihar, Burla', { x: 125, y: h1 - 120, size: 9, font: regularFont })
  page1.drawText('Dist: Sambalpur - 768020 (Odisha)', { x: 215, y: h1 - 132, size: 9, font: regularFont })

  // Divider Line
  page1.drawLine({ start: { x: 50, y: h1 - 145 }, end: { x: w1 - 50, y: h1 - 145 }, thickness: 1, color: rgb(0.09, 0.53, 0.27) })

  // Reference and Date
  const fullRefNo = `Ref No: MCL/GM/HRD/2026-27/${data.serialNo || '42'}`
  page1.drawText(fullRefNo, { x: 50, y: h1 - 170, size: 10, font: boldFont })
  page1.drawText(`Date: ${currentDate}`, { x: w1 - 150, y: h1 - 170, size: 10, font: regularFont })

  // To Address
  page1.drawText('To,', { x: 50, y: h1 - 200, size: 11, font: regularFont })
  page1.drawText('The Placement Officer,', { x: 50, y: h1 - 215, size: 11, font: regularFont })
  page1.drawText(data.university || 'Kalinga Institute of Industrial Technology,', { x: 50, y: h1 - 230, size: 11, font: boldFont })
  page1.drawText('Bhubaneswar, Odisha.', { x: 50, y: h1 - 245, size: 11, font: regularFont })

  // Subject
  page1.drawText('Subject: Permission for Internship Training.', { x: 50, y: h1 - 280, size: 11, font: boldFont, color: rgb(0.09, 0.53, 0.27) })

  // Body Start
  page1.drawText('Dear Sir/Madam,', { x: 50, y: h1 - 310, size: 11, font: regularFont })
  
  const bodyText = 'Reference to the request on the above subject, you are informed that permission is granted for internship training to the student as per the details given below:-'
  
  // Wrap text
  page1.drawText(bodyText.substring(0, 85), { x: 50, y: h1 - 335, size: 10, font: regularFont })
  page1.drawText(bodyText.substring(85), { x: 50, y: h1 - 350, size: 10, font: regularFont })

  // Table Configuration
  const tableY = h1 - 470
  const colWidths = [120, 95, 105, 95, 80] // Sum = 495
  const tableX = 50
  
  // Draw Table Outer Border
  page1.drawRectangle({ x: tableX, y: tableY, width: 495, height: 90, borderColor: rgb(0.09, 0.53, 0.27), borderWidth: 1 })
  
  // Draw Headers Row Line
  page1.drawLine({ start: { x: tableX, y: tableY + 60 }, end: { x: tableX + 495, y: tableY + 60 }, thickness: 1, color: rgb(0.09, 0.53, 0.27) })
  
  // Draw Vertical Column Dividers
  let currentX = tableX
  for (let i = 0; i < colWidths.length - 1; i++) {
    currentX += colWidths[i]
    page1.drawLine({ start: { x: currentX, y: tableY }, end: { x: currentX, y: tableY + 90 }, thickness: 1, color: rgb(0.09, 0.53, 0.27) })
  }

  // Draw Headers Text
  page1.drawText('Institute Name', { x: tableX + 8, y: tableY + 70, size: 9, font: boldFont })
  page1.drawText('Branch', { x: tableX + 128, y: tableY + 70, size: 9, font: boldFont })
  page1.drawText('Student Name', { x: tableX + 223, y: tableY + 70, size: 9, font: boldFont })
  page1.drawText('Period', { x: tableX + 328, y: tableY + 70, size: 9, font: boldFont })
  page1.drawText('Training Place', { x: tableX + 423, y: tableY + 70, size: 9, font: boldFont })

  // Draw Values Text
  page1.drawText(data.university || 'KIIT University', { x: tableX + 8, y: tableY + 30, size: 8, font: regularFont })
  page1.drawText(data.wing || 'B.TECH (CSE)', { x: tableX + 128, y: tableY + 30, size: 8, font: regularFont })
  page1.drawText(`${data.fullName}\n(${data.rollNo})`, { x: tableX + 223, y: tableY + 35, size: 8, font: regularFont })
  page1.drawText(`${data.startDate}\nTo\n${data.endDate}`, { x: tableX + 328, y: tableY + 40, size: 8, font: regularFont })
  page1.drawText('Talcher Area\nMCL', { x: tableX + 423, y: tableY + 35, size: 8, font: boldFont })

  // Terms and Conditions Title
  page1.drawText('Training is being given to the student on the basis of the following terms and conditions:-', { x: 50, y: tableY - 30, size: 10, font: boldFont })

  // Terms List
  const terms = [
    '1. The information collected by the student will be used only for educational purpose.',
    '2. The Company will not be responsible for any injury/accident caused to the student during the training period.',
    '3. No accommodation and transportation will be provided to the student by the company.',
    '4. The training will be at their own risk, if anything happens during their training period, the company will not be responsible.',
    '5. No financial burden will be borne by MCL.',
    '6. Any other conditions imposed by the concerned sector/project/department.'
  ]

  let currentY = tableY - 55
  for (const term of terms) {
    if (term.length > 90) {
      page1.drawText(term.substring(0, 90), { x: 50, y: currentY, size: 9, font: regularFont })
      currentY -= 12
      page1.drawText(term.substring(90), { x: 60, y: currentY, size: 9, font: regularFont })
    } else {
      page1.drawText(term, { x: 50, y: currentY, size: 9, font: regularFont })
    }
    currentY -= 20
  }

  // --- PAGE 2 ---
  const page2 = pdfDoc.addPage([595, 842])
  const { height: h2 } = page2.getSize()

  page2.drawText('MAHANADI COALFIELDS LIMITED', { x: 140, y: h2 - 60, size: 18, font: boldFont, color: rgb(0.09, 0.53, 0.27) })
  page2.drawLine({ start: { x: 50, y: h2 - 75 }, end: { x: 545, y: h2 - 75 }, thickness: 1, color: rgb(0.09, 0.53, 0.27) })

  // Instruction Paragraph
  const instructionText = 'You are requested to advise the above student to report to the General Manager, Talcher Area, MCL HQ as per the above date along with his identity card for further necessary action.'
  page2.drawText(instructionText.substring(0, 90), { x: 50, y: h2 - 120, size: 11, font: regularFont })
  page2.drawText(instructionText.substring(90), { x: 50, y: h2 - 138, size: 11, font: regularFont })

  // Signature Block
  page2.drawText('Yours Sincerely,', { x: 380, y: h2 - 220, size: 11, font: regularFont })
  page2.drawText('Deputy Manager (P/HRD)', { x: 380, y: h2 - 280, size: 11, font: boldFont })
  page2.drawText('MCL Headquarters', { x: 380, y: h2 - 295, size: 11, font: regularFont })

  // Copy To Section
  page2.drawText('Copy to:-', { x: 50, y: h2 - 360, size: 11, font: boldFont })
  page2.drawText('1. General Manager, Talcher Area, MCL - for kind confirmation of training and intimation to', { x: 50, y: h2 - 385, size: 10, font: regularFont })
  page2.drawText('   GM (HRD), MCL.', { x: 50, y: h2 - 400, size: 10, font: regularFont })
  page2.drawText('2. Office Copy.', { x: 50, y: h2 - 425, size: 10, font: regularFont })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

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

    if (role === 'student' && start_date && end_date) {
      const { error: internshipError } = await adminClient.from('internships').insert({
        student_id: newUser.user.id,
        start_date,
        end_date,
        is_active: true,
        serial_no: serial_no || null
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

          let attachmentsList: any[] = []

          // If the user created is a student, generate the A4 PDF joining letter and attach it
          if (isStudent) {
            const pdfBuffer = await generateJoiningLetterPDF({
              fullName: full_name,
              rollNo: roll_no || 'N/A',
              university: university || 'N/A',
              wing: wing || 'N/A',
              startDate: start_date || 'N/A',
              endDate: end_date || 'N/A',
              serialNo: serial_no || '42'
            })
            
            attachmentsList.push({
              filename: 'MCL_Internship_Joining_Letter.pdf',
              content: pdfBuffer,
              contentType: 'application/pdf'
            })
          }

          const htmlContent = isStudent
            ? `
              <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <div style="background: #166534; padding: 24px 32px;">
                  <h1 style="color: #fff; margin: 0; font-size: 20px;">Mahanadi Coalfields Limited</h1>
                  <p style="color: #bbf7d0; margin: 4px 0 0; font-size: 13px;">A Subsidiary of Coal India Limited</p>
                </div>
                <div style="padding: 32px;">
                  <h2 style="color: #166534; margin-top: 0;">Internship Registration & Credentials</h2>
                  <p>Dear <strong>${full_name}</strong>,</p>
                  <p>We are pleased to inform you that you have been registered for an internship at <strong>Mahanadi Coalfields Limited (Talcher Area)</strong>.</p>
                  
                  <p><strong>Important:</strong> We have attached your official <strong>MCL Joining / Reporting Letter</strong> as a PDF to this email. Please download, print, and carry it with you when reporting to the Talcher Area HQ.</p>

                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 8px; font-weight: 600; color: #374151;">Portal Login Credentials</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Password:</strong> ${password}</p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Please change your password after logging in for the first time.</p>
                  </div>

                  <p>You can access the portal to mark attendance and view study materials using the credentials above.</p>
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
            attachments: attachmentsList
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
