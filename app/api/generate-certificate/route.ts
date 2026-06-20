import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    const { internshipId, studentName } = await req.json()
    const adminClient = createAdminClient()

    const { data: internship, error: fetchError } = await adminClient
      .from('internships')
      .select('*, student:profiles!internships_student_id_fkey(full_name, email), mentor:profiles!internships_mentor_id_fkey(full_name)')
      .eq('id', internshipId)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })
    if (!internship) return NextResponse.json({ error: 'Internship not found' }, { status: 404 })

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([842, 595])
    const { width, height } = page.getSize()

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

    page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: rgb(0.09, 0.53, 0.27), borderWidth: 3 })
    page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: rgb(0.09, 0.53, 0.27), borderWidth: 1 })

    page.drawText('MAHANADI COALFIELDS LIMITED', { x: 180, y: height - 80, size: 24, font: boldFont, color: rgb(0.09, 0.53, 0.27) })
    page.drawText('A Subsidiary of Coal India Limited', { x: 280, y: height - 108, size: 12, font: regularFont, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('CERTIFICATE OF INTERNSHIP', { x: 230, y: height - 160, size: 20, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    page.drawText('This is to certify that', { x: 290, y: height - 220, size: 14, font: regularFont, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(studentName || internship.student?.full_name || 'Intern', { x: 260, y: height - 260, size: 22, font: boldFont, color: rgb(0.09, 0.53, 0.27) })
    page.drawText('has successfully completed the internship training at', { x: 200, y: height - 300, size: 13, font: regularFont, color: rgb(0.3, 0.3, 0.3) })
    page.drawText('Mahanadi Coalfields Limited', { x: 270, y: height - 330, size: 15, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(`from  ${internship.start_date}  to  ${internship.end_date}`, { x: 295, y: height - 365, size: 13, font: regularFont, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(`Mentor: ${internship.mentor?.full_name || 'N/A'}`, { x: 80, y: 80, size: 11, font: regularFont, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('Training & Development Department', { x: 570, y: 80, size: 10, font: regularFont, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('Mahanadi Coalfields Limited', { x: 590, y: 65, size: 10, font: regularFont, color: rgb(0.4, 0.4, 0.4) })

    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = Buffer.from(pdfBytes)
    const filePath = `${internshipId}/certificate.pdf`

    const { error: uploadError } = await adminClient.storage
      .from('certificates')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from('certificates')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365) // 1 year

    if (signedUrlError) return NextResponse.json({ error: signedUrlError.message }, { status: 500 })

    const { error: updateError } = await adminClient
      .from('internships')
      .update({ certificate_url: signedUrlData.signedUrl })
      .eq('id', internshipId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Send the generated certificate via email to the student
    const studentEmail = internship.student?.email
    const internName = internship.student?.full_name || studentName || 'Intern'

    if (studentEmail && process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
          },
        })

        await transporter.sendMail({
          from: `"MCL Internship Portal" <${process.env.GMAIL_USER}>`,
          to: studentEmail,
          subject: 'MCL Internship Certificate Issued!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
              <div style="background: #166534; padding: 24px 32px; color: #fff;">
                <h1 style="margin: 0; font-size: 20px;">Mahanadi Coalfields Limited</h1>
                <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">A Subsidiary of Coal India Limited</p>
              </div>
              <div style="padding: 32px; color: #374151;">
                <h2 style="color: #166534; margin-top: 0;">Congratulations on completing your Internship!</h2>
                <p>Dear <strong>${internName}</strong>,</p>
                <p>We are pleased to inform you that your official **Certificate of Internship** has been approved and issued by the Admin.</p>
                <p>We have **attached your Certificate PDF** directly to this email for your records.</p>
                <p>Alternatively, you can view and download it at any time by logging into the internship portal.</p>
                <p>We wish you the very best in your future career endeavors!</p>
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
          attachments: [
            {
              filename: `${internName.replace(/\s+/g, '_')}_MCL_Internship_Certificate.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf'
            }
          ]
        })
        console.log(`[GENERATE-CERTIFICATE] Certificate emailed to ${studentEmail}`)
      } catch (emailErr: any) {
        console.error(`[GENERATE-CERTIFICATE] Failed to email certificate to ${studentEmail}:`, emailErr.message)
      }
    }

    return NextResponse.json({ success: true, certificateUrl: signedUrlData.signedUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
