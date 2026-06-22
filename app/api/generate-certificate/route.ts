import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'

// Helper function to wrap text
function wrapText(text: string, maxWidth: number, size: number, font: any) {
  const words = text.split(' ')
  const lines = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = font.widthOfTextAtSize(testLine, size)
    if (testWidth > maxWidth) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }
  return lines
}

// Helper to format dates professionally
function formatDate(dateStr: string | null) {
  if (!dateStr) return 'N/A'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } catch (e) {
    return dateStr
  }
}

// Helper to sanitize text for standard PDF fonts (WinAnsi encoding)
function sanitizeText(text: string | null | undefined): string {
  if (!text) return ''
  return String(text)
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2013\u2014]/g, '-') // En-dash and em-dash
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip accents
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, signature_data')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    const adminName = sanitizeText(profile?.full_name || 'Admin Coordinator')
    const adminSignatureData = profile?.signature_data

    const { internshipId, studentName } = await req.json()
    const adminClient = createAdminClient()

    const { data: internship, error: fetchError } = await adminClient
      .from('internships')
      .select('*, student:profiles!internships_student_id_fkey(full_name, email, university, wing, area), mentor:profiles!internships_mentor_id_fkey(full_name, signature_data)')
      .eq('id', internshipId)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })
    if (!internship) return NextResponse.json({ error: 'Internship not found' }, { status: 404 })

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([842, 595])
    const { width, height } = page.getSize()

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    // 1. Draw Cream Background
    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      color: rgb(0.99, 0.98, 0.95)
    })

    // 2. Draw Outer Green Border
    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: rgb(0.06, 0.35, 0.18),
      borderWidth: 8
    })

    // 3. Draw Inner Gold Border
    page.drawRectangle({
      x: 34,
      y: 34,
      width: width - 68,
      height: height - 68,
      borderColor: rgb(0.76, 0.6, 0.21),
      borderWidth: 2
    })

    // 4. Load Logos
    const mclLogoPath = path.join(process.cwd(), 'public', 'mcl-logo-transparent.png')
    const coalIndiaLogoPath = path.join(process.cwd(), 'public', 'coal-india-logo-transparent.png')

    let mclLogoImg: any = null
    let coalIndiaLogoImg: any = null

    try {
      if (fs.existsSync(mclLogoPath)) {
        const mclLogoBytes = fs.readFileSync(mclLogoPath)
        mclLogoImg = await pdfDoc.embedPng(mclLogoBytes)
      }
    } catch (e) {
      console.error('Failed to embed MCL logo:', e)
    }

    try {
      if (fs.existsSync(coalIndiaLogoPath)) {
        const coalIndiaLogoBytes = fs.readFileSync(coalIndiaLogoPath)
        coalIndiaLogoImg = await pdfDoc.embedPng(coalIndiaLogoBytes)
      }
    } catch (e) {
      console.error('Failed to embed Coal India logo:', e)
    }

    // Draw Left Logo (MCL)
    if (mclLogoImg) {
      const logoHeight = 60
      const logoWidth = logoHeight * 1.22
      page.drawImage(mclLogoImg, {
        x: 65,
        y: height - 115,
        width: logoWidth,
        height: logoHeight,
      })
    }

    // Draw Right Logo (Coal India or fallback to MCL)
    const rightImg = coalIndiaLogoImg || mclLogoImg
    if (rightImg) {
      const logoHeight = 60
      const isMcl = rightImg === mclLogoImg
      const logoWidth = logoHeight * (isMcl ? 1.22 : 0.74)
      page.drawImage(rightImg, {
        x: width - 65 - logoWidth,
        y: height - 115,
        width: logoWidth,
        height: logoHeight,
      })
    }

    // Helper to draw centered text
    const drawCenteredText = (text: string, y: number, size: number, font: any, color = rgb(0.2, 0.2, 0.2)) => {
      const textWidth = font.widthOfTextAtSize(text, size)
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y,
        size,
        font,
        color
      })
    }

    // 5. Draw Header Text
    const titleText = 'MAHANADI COALFIELDS LIMITED'
    const subText = 'A Subsidiary of Coal India Limited'
    const certTitle = 'CERTIFICATE OF COMPLETION'

    drawCenteredText(titleText, height - 75, 22, boldFont, rgb(0.06, 0.35, 0.18))
    drawCenteredText(subText, height - 95, 11, regularFont, rgb(0.4, 0.4, 0.4))

    // Divider Line
    page.drawLine({
      start: { x: 150, y: height - 110 },
      end: { x: width - 150, y: height - 110 },
      color: rgb(0.76, 0.6, 0.21),
      thickness: 1.5
    })

    drawCenteredText(certTitle, height - 145, 18, boldFont, rgb(0.2, 0.2, 0.2))

    // 6. Metadata (Serial No & Issue Date)
    const serialNo = internship.serial_no || 'N/A'
    const issueDate = formatDate(new Date().toISOString().split('T')[0])
    page.drawText(`Serial No: MCL/HRD/INT/${serialNo}`, { x: 50, y: height - 50, size: 9, font: regularFont, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(`Date of Issue: ${issueDate}`, { x: width - 200, y: height - 50, size: 9, font: regularFont, color: rgb(0.4, 0.4, 0.4) })

    // 7. Dynamic Paragraph & Student Details
    const student = sanitizeText(studentName || internship.student?.full_name || 'Intern')
    const university = sanitizeText(internship.student?.university || 'their respective institution')
    const wing = sanitizeText(internship.student?.wing || internship.wing || 'Training Wing')
    const startDate = sanitizeText(formatDate(internship.start_date))
    const endDate = sanitizeText(formatDate(internship.end_date))
    const projectTitle = sanitizeText(internship.project_title || 'N/A')
    const projectDate = sanitizeText(formatDate(internship.project_submitted_at))
    const mentorName = sanitizeText(internship.mentor?.full_name || 'N/A')
    const area = sanitizeText(internship.student?.area || 'Talcher')

    // Structured Centered Text Layout
    drawCenteredText('This is to certify that', 385, 13, regularFont, rgb(0.4, 0.4, 0.4))
    drawCenteredText(student.toUpperCase(), 350, 22, boldFont, rgb(0.06, 0.35, 0.18))
    drawCenteredText(`student of ${university} has successfully completed their internship training in the`, 315, 12, regularFont, rgb(0.2, 0.2, 0.2))
    
    const areaText = area === 'Headquarters' ? 'Headquarters' : `${area} Area`
    drawCenteredText(`${wing} department at ${areaText}, Mahanadi Coalfields Limited from ${startDate} to ${endDate}.`, 290, 13, boldFont, rgb(0.2, 0.2, 0.2))
    drawCenteredText('They have submitted a final project report titled', 255, 12, regularFont, rgb(0.2, 0.2, 0.2))

    // Dynamically wrap project title if it is too long
    const wrappedTitle = wrapText(`"${projectTitle}"`, 620, 12, italicFont)
    let titleY = 225
    for (const titleLine of wrappedTitle) {
      drawCenteredText(titleLine, titleY, 12, italicFont, rgb(0.06, 0.35, 0.18))
      titleY -= 16
    }

    const nextY = titleY - 10
    drawCenteredText(`on ${projectDate} under the guidance of mentor ${mentorName}.`, nextY, 12, regularFont, rgb(0.2, 0.2, 0.2))

    // Generate QR Code dynamically
    let qrCodeImg = null
    try {
      const verifyUrl = `${req.nextUrl.origin}/verify/${internshipId}`
      const qrCodeBase64 = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 })
      const qrCodePngBytes = Buffer.from(qrCodeBase64.split(',')[1], 'base64')
      qrCodeImg = await pdfDoc.embedPng(qrCodePngBytes)
    } catch (e) {
      console.error('Failed to generate QR Code:', e)
    }

    // Draw Verification QR Code centered horizontally above signature lines
    if (qrCodeImg) {
      const qrSize = 45
      page.drawImage(qrCodeImg, {
        x: (width - qrSize) / 2,
        y: 130,
        width: qrSize,
        height: qrSize
      })
      drawCenteredText('Scan to Verify', 122, 6, italicFont, rgb(0.5, 0.5, 0.5))
    }

    // Load GM HRD signature
    const gmSigPath = path.join(process.cwd(), 'public', 'gm-signature.png')
    let gmSigImg = null
    try {
      if (fs.existsSync(gmSigPath)) {
        const gmSigBytes = fs.readFileSync(gmSigPath)
        gmSigImg = await pdfDoc.embedPng(gmSigBytes)
      }
    } catch (e) {
      console.error('Failed to embed GM HRD signature:', e)
    }

    // Load Mentor dynamic signature
    let mentorSigImg = null
    if (internship.mentor?.signature_data) {
      try {
        const base64Data = internship.mentor.signature_data.split(',')[1]
        const signatureBuffer = Buffer.from(base64Data, 'base64')
        mentorSigImg = await pdfDoc.embedPng(signatureBuffer)
      } catch (e) {
        console.error('Failed to embed Mentor signature:', e)
      }
    }

    // Load Admin dynamic signature (acting as Project Coordinator)
    let adminSigImg = null
    if (adminSignatureData) {
      try {
        const base64Data = adminSignatureData.split(',')[1]
        const signatureBuffer = Buffer.from(base64Data, 'base64')
        adminSigImg = await pdfDoc.embedPng(signatureBuffer)
      } catch (e) {
        console.error('Failed to embed Admin signature:', e)
      }
    }

    // 8. Signatures Section at the Bottom (Three Columns)
    // Left Side - Mentor
    if (mentorSigImg) {
      const sigWidth = 90
      const sigHeight = sigWidth / 2.67
      page.drawImage(mentorSigImg, {
        x: 155 - (sigWidth / 2), // centered on line x:80..230
        y: 80,
        width: sigWidth,
        height: sigHeight
      })
    }
    page.drawLine({ start: { x: 80, y: 75 }, end: { x: 230, y: 75 }, color: rgb(0.6, 0.6, 0.6), thickness: 1 })
    const mentorTitle = 'Project Mentor'
    const mentorTitleWidth = boldFont.widthOfTextAtSize(mentorTitle, 10)
    page.drawText(mentorTitle, { x: 155 - (mentorTitleWidth / 2), y: 58, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    const mentorLabel = `(${mentorName})`
    const mentorLabelWidth = regularFont.widthOfTextAtSize(mentorLabel, 9)
    page.drawText(mentorLabel, { x: 155 - (mentorLabelWidth / 2), y: 44, size: 9, font: regularFont, color: rgb(0.4, 0.4, 0.4) })

    // Center Side - Project Coordinator (Admin)
    if (adminSigImg) {
      const sigWidth = 90
      const sigHeight = sigWidth / 2.67
      page.drawImage(adminSigImg, {
        x: 421 - (sigWidth / 2), // centered on line x:346..496
        y: 80,
        width: sigWidth,
        height: sigHeight
      })
    }
    page.drawLine({ start: { x: 346, y: 75 }, end: { x: 496, y: 75 }, color: rgb(0.6, 0.6, 0.6), thickness: 1 })
    const adminTitle = 'Area Training Officer'
    const adminTitleWidth = boldFont.widthOfTextAtSize(adminTitle, 10)
    page.drawText(adminTitle, { x: 421 - (adminTitleWidth / 2), y: 58, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    const adminLabel = `(${adminName})`
    const adminLabelWidth = regularFont.widthOfTextAtSize(adminLabel, 9)
    page.drawText(adminLabel, { x: 421 - (adminLabelWidth / 2), y: 44, size: 9, font: regularFont, color: rgb(0.4, 0.4, 0.4) })

    // Right Side - GM (HRD)
    if (gmSigImg) {
      const sigWidth = 100
      const sigHeight = sigWidth / 2.90
      page.drawImage(gmSigImg, {
        x: 687 - (sigWidth / 2), // centered on line x:612..762
        y: 80,
        width: sigWidth,
        height: sigHeight
      })
    }
    page.drawLine({ start: { x: 612, y: 75 }, end: { x: 762, y: 75 }, color: rgb(0.6, 0.6, 0.6), thickness: 1 })
    const gmTitle = 'General Manager (HRD)'
    const gmTitleWidth = boldFont.widthOfTextAtSize(gmTitle, 10)
    page.drawText(gmTitle, { x: 687 - (gmTitleWidth / 2), y: 58, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    const coLabel = 'Mahanadi Coalfields Limited'
    const coLabelWidth = regularFont.widthOfTextAtSize(coLabel, 9)
    page.drawText(coLabel, { x: 687 - (coLabelWidth / 2), y: 44, size: 9, font: regularFont, color: rgb(0.4, 0.4, 0.4) })

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
