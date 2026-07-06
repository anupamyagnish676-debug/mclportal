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

    // ═══════════════════════════════════════════
    // BACKGROUND LAYERS
    // ═══════════════════════════════════════════

    // Full-page rich ivory background
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.98, 0.97, 0.93) })

    // Subtle green header band at top
    page.drawRectangle({ x: 0, y: height - 140, width, height: 140, color: rgb(0.04, 0.22, 0.12) })

    // Thin gold separator under green header band
    page.drawLine({
      start: { x: 0, y: height - 140 },
      end: { x: width, y: height - 140 },
      color: rgb(0.76, 0.60, 0.21),
      thickness: 3,
    })

    // Subtle green footer band at bottom
    page.drawRectangle({ x: 0, y: 0, width, height: 55, color: rgb(0.04, 0.22, 0.12) })

    // Thin gold separator above footer band
    page.drawLine({
      start: { x: 0, y: 55 },
      end: { x: width, y: 55 },
      color: rgb(0.76, 0.60, 0.21),
      thickness: 3,
    })

    // ═══════════════════════════════════════════
    // PREMIUM BORDER SYSTEM
    // ═══════════════════════════════════════════

    // Outer dark navy/green border
    page.drawRectangle({
      x: 12, y: 12,
      width: width - 24, height: height - 24,
      borderColor: rgb(0.04, 0.22, 0.12),
      borderWidth: 5,
    })

    // Middle gold border
    page.drawRectangle({
      x: 20, y: 20,
      width: width - 40, height: height - 40,
      borderColor: rgb(0.76, 0.60, 0.21),
      borderWidth: 1.5,
    })

    // Inner thin green border for content zone
    page.drawRectangle({
      x: 26, y: 26,
      width: width - 52, height: height - 52,
      borderColor: rgb(0.06, 0.35, 0.18),
      borderWidth: 0.5,
    })

    // ═══════════════════════════════════════════
    // CORNER ORNAMENTS (decorative diamond shapes)
    // ═══════════════════════════════════════════
    const corners = [
      { cx: 37, cy: height - 37 }, // Top-left
      { cx: width - 37, cy: height - 37 }, // Top-right
      { cx: 37, cy: 37 }, // Bottom-left
      { cx: width - 37, cy: 37 }, // Bottom-right
    ]
    for (const { cx, cy } of corners) {
      const s = 7
      // Outer diamond
      page.drawLine({ start: { x: cx, y: cy + s }, end: { x: cx + s, y: cy }, color: rgb(0.76, 0.60, 0.21), thickness: 1.2 })
      page.drawLine({ start: { x: cx + s, y: cy }, end: { x: cx, y: cy - s }, color: rgb(0.76, 0.60, 0.21), thickness: 1.2 })
      page.drawLine({ start: { x: cx, y: cy - s }, end: { x: cx - s, y: cy }, color: rgb(0.76, 0.60, 0.21), thickness: 1.2 })
      page.drawLine({ start: { x: cx - s, y: cy }, end: { x: cx, y: cy + s }, color: rgb(0.76, 0.60, 0.21), thickness: 1.2 })
      // Inner dot
      page.drawRectangle({ x: cx - 2, y: cy - 2, width: 4, height: 4, color: rgb(0.76, 0.60, 0.21) })
    }

    // ═══════════════════════════════════════════
    // LOGOS
    // ═══════════════════════════════════════════
    const ministryLogoPath = path.join(process.cwd(), 'public', 'ministry-of-coal-logo.png')
    const mclLogoPath = path.join(process.cwd(), 'public', 'mcl-logo-new.png')

    let ministryLogoImg: any = null
    let mclLogoImg: any = null

    try {
      if (fs.existsSync(ministryLogoPath)) {
        ministryLogoImg = await pdfDoc.embedPng(fs.readFileSync(ministryLogoPath))
      }
    } catch (e) { console.error('Failed to embed Ministry of Coal logo:', e) }

    try {
      if (fs.existsSync(mclLogoPath)) {
        mclLogoImg = await pdfDoc.embedPng(fs.readFileSync(mclLogoPath))
      }
    } catch (e) { console.error('Failed to embed MCL logo:', e) }

    // Left Logo: Ministry of Coal (aspect 1.776)
    if (ministryLogoImg) {
      const lh = 65, lw = lh * 1.776
      page.drawImage(ministryLogoImg, { x: 55, y: height - 125, width: lw, height: lh })
    }

    // Right Logo: MCL (aspect 1.746)
    if (mclLogoImg) {
      const lh = 65, lw = lh * 1.746
      page.drawImage(mclLogoImg, { x: width - 55 - lw, y: height - 125, width: lw, height: lh })
    }

    // ═══════════════════════════════════════════
    // HELPER
    // ═══════════════════════════════════════════
    const drawCenteredText = (text: string, y: number, size: number, font: any, color = rgb(0.2, 0.2, 0.2)) => {
      const textWidth = font.widthOfTextAtSize(text, size)
      page.drawText(text, { x: (width - textWidth) / 2, y, size, font, color })
    }

    // ═══════════════════════════════════════════
    // HEADER TEXT (inside green band)
    // ═══════════════════════════════════════════
    drawCenteredText('MAHANADI COALFIELDS LIMITED', height - 68, 22, boldFont, rgb(1, 1, 1))
    drawCenteredText('A Subsidiary of Coal India Limited  |  Ministry of Coal, Government of India', height - 90, 9.5, regularFont, rgb(0.72, 0.84, 0.76))

    // Gold ornament line + cert title
    const goldLine = rgb(0.76, 0.60, 0.21)
    page.drawLine({ start: { x: 120, y: height - 108 }, end: { x: 340, y: height - 108 }, color: goldLine, thickness: 0.8 })
    drawCenteredText('✦  CERTIFICATE OF INTERNSHIP COMPLETION  ✦', height - 108, 11, boldFont, rgb(0.96, 0.84, 0.48))
    page.drawLine({ start: { x: width - 340, y: height - 108 }, end: { x: width - 120, y: height - 108 }, color: goldLine, thickness: 0.8 })

    // ═══════════════════════════════════════════
    // METADATA — Serial No & Date
    // ═══════════════════════════════════════════
    const serialNo = internship.serial_no || 'N/A'
    const issueDate = formatDate(new Date().toISOString().split('T')[0])
    page.drawText(`Ref. No.: MCL/HRD/INT/${serialNo}`, { x: 50, y: height - 155, size: 8.5, font: regularFont, color: rgb(0.35, 0.35, 0.35) })
    page.drawText(`Date of Issue: ${issueDate}`, { x: width - 205, y: height - 155, size: 8.5, font: regularFont, color: rgb(0.35, 0.35, 0.35) })

    // ═══════════════════════════════════════════
    // STUDENT DETAILS & CERTIFICATE BODY
    // ═══════════════════════════════════════════
    const student = sanitizeText(studentName || internship.student?.full_name || 'Intern')
    const university = sanitizeText(internship.student?.university || 'their respective institution')
    const wing = sanitizeText(internship.student?.wing || internship.wing || 'Training Wing')
    const startDate = sanitizeText(formatDate(internship.start_date))
    const endDate = sanitizeText(formatDate(internship.end_date))
    const projectTitle = sanitizeText(internship.project_title || 'N/A')
    const projectDate = sanitizeText(formatDate(internship.project_submitted_at))
    const mentorName = sanitizeText(internship.mentor?.full_name || 'N/A')
    const area = sanitizeText(internship.student?.area || 'Talcher')
    const areaText = area === 'Headquarters' ? 'Headquarters' : `${area} Area`

    // "This is to certify that" intro
    drawCenteredText('This is to certify that', 380, 12.5, italicFont, rgb(0.35, 0.35, 0.35))

    // Decorative rule before student name
    page.drawLine({ start: { x: 250, y: 371 }, end: { x: 592, y: 371 }, color: goldLine, thickness: 0.6 })

    // Student name — the centrepiece
    drawCenteredText(student.toUpperCase(), 342, 24, boldFont, rgb(0.04, 0.22, 0.12))

    // Decorative rule after student name
    page.drawLine({ start: { x: 250, y: 332 }, end: { x: 592, y: 332 }, color: goldLine, thickness: 0.6 })

    // Body paragraphs
    drawCenteredText(`student of ${university}`, 312, 11.5, regularFont, rgb(0.2, 0.2, 0.2))
    drawCenteredText('has successfully completed their Internship Training in the', 294, 11.5, regularFont, rgb(0.2, 0.2, 0.2))
    drawCenteredText(`${wing} Department, ${areaText}, Mahanadi Coalfields Limited`, 274, 12, boldFont, rgb(0.04, 0.22, 0.12))
    drawCenteredText(`from  ${startDate}  to  ${endDate}`, 254, 11.5, regularFont, rgb(0.2, 0.2, 0.2))

    // Project separator line
    page.drawLine({ start: { x: 200, y: 238 }, end: { x: 642, y: 238 }, color: rgb(0.82, 0.78, 0.70), thickness: 0.5 })
    drawCenteredText('Final Project Report', 222, 9, regularFont, rgb(0.5, 0.5, 0.5))

    // Wrap long project title
    const wrappedTitle = wrapText(`"${projectTitle}"`, 600, 11.5, italicFont)
    let titleY = 208
    for (const line of wrappedTitle) {
      drawCenteredText(line, titleY, 11.5, italicFont, rgb(0.06, 0.35, 0.18))
      titleY -= 15
    }

    const nextY = titleY - 8
    drawCenteredText(`Submitted on ${projectDate}  ·  Mentor: ${mentorName}`, nextY, 10, regularFont, rgb(0.35, 0.35, 0.35))

    // ═══════════════════════════════════════════
    // QR CODE
    // ═══════════════════════════════════════════
    let qrCodeImg = null
    try {
      const verifyUrl = `${req.nextUrl.origin}/verify/${internshipId}`
      const qrCodeBase64 = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 })
      qrCodeImg = await pdfDoc.embedPng(Buffer.from(qrCodeBase64.split(',')[1], 'base64'))
    } catch (e) { console.error('Failed to generate QR Code:', e) }

    if (qrCodeImg) {
      const qrSize = 42
      page.drawImage(qrCodeImg, { x: (width - qrSize) / 2, y: 65, width: qrSize, height: qrSize })
      drawCenteredText('Scan to Verify Authenticity', 60, 6, italicFont, rgb(0.72, 0.84, 0.76))
    }

    // ═══════════════════════════════════════════
    // FOOTER TEXT (inside footer band)
    // ═══════════════════════════════════════════
    drawCenteredText('Training & Development Department  |  Mahanadi Coalfields Limited, Sambalpur, Odisha', 20, 8, regularFont, rgb(0.72, 0.84, 0.76))

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

    // ═══════════════════════════════════════════
    // SIGNATURES SECTION — Three Columns, above footer band
    // ═══════════════════════════════════════════
    const sigLineY = 135   // gold signature line Y
    const sigImgY  = 140   // signature image base Y
    const titleY2  = 118   // role title Y
    const labelY2  = 106   // name label Y

    const goldSig = rgb(0.76, 0.60, 0.21)

    // Left — Mentor
    if (mentorSigImg) {
      const sw = 90, sh = sw / 2.67
      page.drawImage(mentorSigImg, { x: 155 - sw / 2, y: sigImgY, width: sw, height: sh })
    }
    page.drawLine({ start: { x: 75, y: sigLineY }, end: { x: 235, y: sigLineY }, color: goldSig, thickness: 0.8 })
    const mentorTitle = 'Project Mentor'
    page.drawText(mentorTitle, { x: 155 - boldFont.widthOfTextAtSize(mentorTitle, 9.5) / 2, y: titleY2, size: 9.5, font: boldFont, color: rgb(0.15, 0.15, 0.15) })
    const mentorLabel = `(${mentorName})`
    page.drawText(mentorLabel, { x: 155 - regularFont.widthOfTextAtSize(mentorLabel, 8.5) / 2, y: labelY2, size: 8.5, font: regularFont, color: rgb(0.4, 0.4, 0.4) })

    // Center — Area Training Officer (Admin)
    if (adminSigImg) {
      const sw = 90, sh = sw / 2.67
      page.drawImage(adminSigImg, { x: 421 - sw / 2, y: sigImgY, width: sw, height: sh })
    }
    page.drawLine({ start: { x: 341, y: sigLineY }, end: { x: 501, y: sigLineY }, color: goldSig, thickness: 0.8 })
    const adminTitle = 'Area Training Officer'
    page.drawText(adminTitle, { x: 421 - boldFont.widthOfTextAtSize(adminTitle, 9.5) / 2, y: titleY2, size: 9.5, font: boldFont, color: rgb(0.15, 0.15, 0.15) })
    const adminLabel = `(${adminName})`
    page.drawText(adminLabel, { x: 421 - regularFont.widthOfTextAtSize(adminLabel, 8.5) / 2, y: labelY2, size: 8.5, font: regularFont, color: rgb(0.4, 0.4, 0.4) })

    // Right — General Manager (HRD)
    if (gmSigImg) {
      const sw = 100, sh = sw / 2.90
      page.drawImage(gmSigImg, { x: 687 - sw / 2, y: sigImgY, width: sw, height: sh })
    }
    page.drawLine({ start: { x: 607, y: sigLineY }, end: { x: 767, y: sigLineY }, color: goldSig, thickness: 0.8 })
    const gmTitle = 'General Manager (HRD)'
    page.drawText(gmTitle, { x: 687 - boldFont.widthOfTextAtSize(gmTitle, 9.5) / 2, y: titleY2, size: 9.5, font: boldFont, color: rgb(0.15, 0.15, 0.15) })
    const coLabel = 'Mahanadi Coalfields Limited'
    page.drawText(coLabel, { x: 687 - regularFont.widthOfTextAtSize(coLabel, 8.5) / 2, y: labelY2, size: 8.5, font: regularFont, color: rgb(0.4, 0.4, 0.4) })

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
