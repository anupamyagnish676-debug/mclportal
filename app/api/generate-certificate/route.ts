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

    const isPaidIntern = internship.internship_type === 'paid'

    // Fetch Finance Officer for the student's area (for paid interns)
    let financeOfficerName = ''
    let financeOfficerSignatureData: string | null = null
    if (isPaidIntern) {
      const studentArea = internship.student?.area
      if (studentArea) {
        const { data: financeProfile } = await adminClient
          .from('profiles')
          .select('full_name, signature_data')
          .eq('role', 'finance')
          .eq('area', studentArea)
          .limit(1)
          .maybeSingle() as { data: any }
        financeOfficerName = sanitizeText(financeProfile?.full_name || 'Finance Officer')
        financeOfficerSignatureData = financeProfile?.signature_data || null
      }
    }

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
    const ministryLogoPath = path.join(process.cwd(), 'public', 'ministry-of-coal-logo.png')
    const mclLogoPath = path.join(process.cwd(), 'public', 'mcl-logo-new.png')

    let ministryLogoImg: any = null
    let mclLogoImg: any = null

    try {
      if (fs.existsSync(ministryLogoPath)) {
        const bytes = fs.readFileSync(ministryLogoPath)
        ministryLogoImg = await pdfDoc.embedPng(bytes)
      }
    } catch (e) {
      console.error('Failed to embed Ministry of Coal logo:', e)
    }

    try {
      if (fs.existsSync(mclLogoPath)) {
        const bytes = fs.readFileSync(mclLogoPath)
        mclLogoImg = await pdfDoc.embedPng(bytes)
      }
    } catch (e) {
      console.error('Failed to embed MCL logo:', e)
    }

    // Draw Left Logo (Ministry of Coal)
    if (ministryLogoImg) {
      const logoHeight = 60
      const logoWidth = logoHeight * 1.776
      page.drawImage(ministryLogoImg, {
        x: 65,
        y: height - 115,
        width: logoWidth,
        height: logoHeight,
      })
    }

    // Draw Right Logo (MCL)
    if (mclLogoImg) {
      const logoHeight = 60
      const logoWidth = logoHeight * 1.746
      page.drawImage(mclLogoImg, {
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

    // For paid interns: add stipend acknowledgment line
    if (isPaidIntern) {
      const stipendY = nextY - 22
      drawCenteredText(
        'During the tenure, the intern was entitled to and received a monthly stipend as per MCL norms,',
        stipendY, 11, italicFont, rgb(0.35, 0.35, 0.35)
      )
      drawCenteredText(
        'duly verified and disbursed by the Finance Department.',
        stipendY - 14, 11, italicFont, rgb(0.35, 0.35, 0.35)
      )
    }

    // Generate QR Code dynamically
    // Security: Use HMAC-SHA256(secret, serial_no) as the verification token.
    // This is unguessable without the server secret — prevents enumeration attacks (IDOR).
    let qrCodeImg = null
    try {
      const { createHmac } = await import('crypto')
      const hmacSecret = process.env.CERT_HMAC_SECRET || ''
      const verifyToken = createHmac('sha256', hmacSecret)
        .update(String(internship.serial_no))
        .digest('hex')
      const verifyUrl = `${req.nextUrl.origin}/verify/${verifyToken}`
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

    // Load Finance Officer signature (paid interns only)
    let financeSigImg = null
    if (isPaidIntern && financeOfficerSignatureData) {
      try {
        const base64Data = financeOfficerSignatureData.split(',')[1]
        const signatureBuffer = Buffer.from(base64Data, 'base64')
        financeSigImg = await pdfDoc.embedPng(signatureBuffer)
      } catch (e) {
        console.error('Failed to embed Finance Officer signature:', e)
      }
    }

    // 8. Signatures Section
    // For paid interns: 4 columns. For unpaid: 3 columns.
    const sigCols = isPaidIntern
      ? [
          { x: 108, label: 'Project Mentor',        sublabel: `(${mentorName})`,             sigImg: mentorSigImg },
          { x: 288, label: 'Area Training Officer',  sublabel: `(${adminName})`,              sigImg: adminSigImg  },
          { x: 468, label: 'Finance Officer',        sublabel: `(${financeOfficerName})`,     sigImg: financeSigImg },
          { x: 648, label: 'General Manager (HRD)',  sublabel: 'Mahanadi Coalfields Limited', sigImg: gmSigImg      },
        ]
      : [
          { x: 155, label: 'Project Mentor',        sublabel: `(${mentorName})`,             sigImg: mentorSigImg },
          { x: 421, label: 'Area Training Officer',  sublabel: `(${adminName})`,              sigImg: adminSigImg  },
          { x: 687, label: 'General Manager (HRD)',  sublabel: 'Mahanadi Coalfields Limited', sigImg: gmSigImg      },
        ]

    const colHalfWidth = isPaidIntern ? 75 : 75 // half of line width per column
    const lineHalfWidth = isPaidIntern ? 75 : 75

    for (const col of sigCols) {
      // Draw signature image if available
      if (col.sigImg) {
        const sigWidth = 80
        const sigHeight = sigWidth / 2.67
        page.drawImage(col.sigImg, {
          x: col.x - sigWidth / 2,
          y: 80,
          width: sigWidth,
          height: sigHeight,
        })
      }
      // Draw signature line
      page.drawLine({
        start: { x: col.x - lineHalfWidth, y: 75 },
        end:   { x: col.x + lineHalfWidth, y: 75 },
        color: rgb(0.6, 0.6, 0.6),
        thickness: 1,
      })
      // Draw title
      const titleW = boldFont.widthOfTextAtSize(col.label, 9)
      page.drawText(col.label, { x: col.x - titleW / 2, y: 58, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
      // Draw sublabel
      const subW = regularFont.widthOfTextAtSize(col.sublabel, 8)
      page.drawText(col.sublabel, { x: col.x - subW / 2, y: 45, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) })
    }

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
