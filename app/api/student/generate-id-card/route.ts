import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'
import { Jimp } from 'jimp'
import { getGDriveFileStream } from '@/lib/gdrive'

export const revalidate = 0

// Helper to strip white background from signature images using Jimp
async function makeTransparent(base64Str: string): Promise<Buffer> {
  const base64Data = base64Str.includes(',') ? base64Str.split(',')[1] : base64Str
  const imageBuffer = Buffer.from(base64Data, 'base64')
  
  const image = await Jimp.read(imageBuffer)
  
  // Replace white/near-white pixels with transparent ones
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
    const r = image.bitmap.data[idx + 0]
    const g = image.bitmap.data[idx + 1]
    const b = image.bitmap.data[idx + 2]
    
    if (r > 240 && g > 240 && b > 240) {
      image.bitmap.data[idx + 3] = 0 // Alpha = 0
    }
  })
  
  return await image.getBuffer('image/png')
}

// Helper to fetch passport photo buffer from Drive/Supabase
async function getPhotoBuffer(adminClient: any, studentId: string): Promise<Buffer | null> {
  try {
    const { data: photoDoc } = await adminClient
      .from('student_documents')
      .select('file_url, file_path')
      .eq('student_id', studentId)
      .eq('doc_type', 'photo')
      .maybeSingle()

    if (!photoDoc) return null

    // Case 1: GDrive
    if (photoDoc.file_path?.startsWith('gdrive:')) {
      const fileId = photoDoc.file_path.replace('gdrive:', '')
      const { stream } = await getGDriveFileStream(fileId)
      
      // Convert web stream to buffer
      const reader = (stream as any).getReader()
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }
      return Buffer.concat(chunks)
    }

    // Case 2: Supabase storage or HTTP URL
    if (photoDoc.file_url) {
      let fetchUrl = photoDoc.file_url
      if (photoDoc.file_path && !photoDoc.file_path.startsWith('gdrive:')) {
        const { data: signed } = await adminClient.storage
          .from('documents')
          .createSignedUrl(photoDoc.file_path, 300)
        if (signed?.signedUrl) fetchUrl = signed.signedUrl
      }
      const res = await fetch(fetchUrl)
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer()
        return Buffer.from(arrayBuf)
      }
    }
  } catch (e) {
    console.error('[ID-CARD-PDF] Failed to fetch photo buffer:', e)
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) return new NextResponse('Profile not found', { status: 404 })

    const adminClient = createAdminClient()

    // Get active internship
    const { data: internship } = await adminClient
      .from('internships')
      .select('*')
      .eq('student_id', user.id)
      .maybeSingle()

    const areaName = profile.area || internship?.area || 'Headquarters'
    const serialNo = internship?.serial_no || 'N/A'

    // Fetch Area Admin Signature
    let signatureData: string | null = null
    let areaAdminName = 'Area Training Officer'

    if (areaName && areaName !== 'Concerned') {
      const { data: withSig } = await adminClient
        .from('profiles')
        .select('full_name, signature_data')
        .eq('role', 'admin')
        .ilike('area', `%${areaName.replace(/Area Office/gi, '').trim()}%`)
        .not('signature_data', 'is', null)
        .limit(1)

      if (withSig && withSig.length > 0) {
        areaAdminName = withSig[0].full_name || areaAdminName
        signatureData = withSig[0].signature_data
      } else {
        const { data: anyAdmin } = await adminClient
          .from('profiles')
          .select('full_name, signature_data')
          .eq('role', 'admin')
          .ilike('area', `%${areaName.replace(/Area Office/gi, '').trim()}%`)
          .limit(1)
        if (anyAdmin && anyAdmin.length > 0) {
          areaAdminName = anyAdmin[0].full_name || areaAdminName
          signatureData = anyAdmin[0].signature_data
        }
      }
    }

    // Standard CR80 Portrait ID Card Dimensions in Points (72 dpi)
    // 53.98 mm = 153.01 pt (Width), 85.60 mm = 242.65 pt (Height)
    const cardWidth = 153.01
    const cardHeight = 242.65

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([cardWidth, cardHeight])

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const monoFont = await pdfDoc.embedFont(StandardFonts.CourierBold)

    // Colors
    const darkBg = rgb(0.06, 0.09, 0.13)       // #0f172a
    const headerBg = rgb(0.97, 0.98, 0.99)     // #f8fafc
    const amberAccent = rgb(0.96, 0.62, 0.04)  // #f59e0b
    const emeraldDark = rgb(0.04, 0.44, 0.28)  // #0b7047
    const slateGray = rgb(0.38, 0.45, 0.55)    // #64748b
    const textDark = rgb(0.09, 0.13, 0.17)     // #17212b

    // 1. Background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: cardWidth,
      height: cardHeight,
      color: rgb(1, 1, 1),
    })

    // 2. Header Box (Top 36 pt)
    const headerHeight = 34
    const headerY = cardHeight - headerHeight

    page.drawRectangle({
      x: 0,
      y: headerY,
      width: cardWidth,
      height: headerHeight,
      color: headerBg,
    })

    // Header Amber Stripe
    page.drawRectangle({
      x: 0,
      y: headerY,
      width: cardWidth,
      height: 2,
      color: amberAccent,
    })

    // MCL Logo in Header
    const logoPath = path.join(process.cwd(), 'public', 'mcl-logo-transparent.png')
    if (fs.existsSync(logoPath)) {
      try {
        const logoBytes = fs.readFileSync(logoPath)
        const logoImg = await pdfDoc.embedPng(logoBytes)
        page.drawImage(logoImg, {
          x: 6,
          y: headerY + 4,
          width: 24,
          height: 24,
        })
      } catch (e) {}
    }

    // Header Text
    page.drawText('MAHANADI COALFIELDS LTD', {
      x: 34,
      y: headerY + 18,
      size: 6.5,
      font: boldFont,
      color: emeraldDark,
    })
    page.drawText('A Subsidiary of Coal India Limited', {
      x: 34,
      y: headerY + 9,
      size: 5,
      font: regularFont,
      color: slateGray,
    })

    // INTERN ID Badge
    page.drawRectangle({
      x: cardWidth - 36,
      y: headerY + 11,
      width: 30,
      height: 11,
      color: amberAccent,
    })
    page.drawText('INTERN ID', {
      x: cardWidth - 33,
      y: headerY + 14,
      size: 4.5,
      font: boldFont,
      color: rgb(0.2, 0.1, 0),
    })

    // 3. Photo & Details Layout
    const bodyTopY = headerY - 6

    // Passport Photo (Left)
    const photoWidth = 46
    const photoHeight = 58
    const photoX = 8
    const photoY = bodyTopY - photoHeight

    page.drawRectangle({
      x: photoX - 1,
      y: photoY - 1,
      width: photoWidth + 2,
      height: photoHeight + 2,
      color: rgb(1, 1, 1),
      borderColor: emeraldDark,
      borderWidth: 1,
    })

    const photoBuffer = await getPhotoBuffer(adminClient, user.id)
    if (photoBuffer) {
      try {
        let photoImg = null
        if (photoBuffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
          photoImg = await pdfDoc.embedPng(photoBuffer)
        } else {
          photoImg = await pdfDoc.embedJpg(photoBuffer)
        }
        page.drawImage(photoImg, {
          x: photoX,
          y: photoY,
          width: photoWidth,
          height: photoHeight,
        })
      } catch (e) {
        // Fallback photo box
        page.drawRectangle({ x: photoX, y: photoY, width: photoWidth, height: photoHeight, color: rgb(0.95, 0.96, 0.98) })
      }
    } else {
      page.drawRectangle({ x: photoX, y: photoY, width: photoWidth, height: photoHeight, color: rgb(0.95, 0.96, 0.98) })
      page.drawText('NO PHOTO', { x: photoX + 8, y: photoY + 26, size: 6, font: boldFont, color: slateGray })
    }

    // Student Info (Right of Photo)
    const infoX = photoX + photoWidth + 7

    // Trainee Name
    page.drawText('TRAINEE NAME', { x: infoX, y: bodyTopY - 7, size: 4.5, font: boldFont, color: slateGray })
    const nameStr = (profile.full_name || 'STUDENT').toUpperCase()
    page.drawText(nameStr.length > 15 ? `${nameStr.slice(0, 15)}...` : nameStr, {
      x: infoX,
      y: bodyTopY - 16,
      size: 7.5,
      font: boldFont,
      color: emeraldDark,
    })

    // Serial No
    page.drawText('SERIAL NO.', { x: infoX, y: bodyTopY - 26, size: 4.5, font: boldFont, color: slateGray })
    const serialStr = `MCL/HRD/${(areaName || 'HQ').toUpperCase()}/${serialNo}`
    page.drawText(serialStr, {
      x: infoX,
      y: bodyTopY - 34,
      size: 5.5,
      font: monoFont,
      color: textDark,
    })

    // Area
    page.drawText('ALLOCATED AREA', { x: infoX, y: bodyTopY - 44, size: 4.5, font: boldFont, color: slateGray })
    page.drawText(`${areaName} Area`, {
      x: infoX,
      y: bodyTopY - 52,
      size: 6,
      font: boldFont,
      color: emeraldDark,
    })

    // 4. Secondary Details Grid
    const gridY = photoY - 10

    // Grid divider line
    page.drawLine({
      start: { x: 8, y: gridY + 4 },
      end: { x: cardWidth - 8, y: gridY + 4 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    })

    // Col 1: Institution & Wing
    page.drawText('INSTITUTION', { x: 8, y: gridY - 5, size: 4.5, font: boldFont, color: slateGray })
    const instStr = profile.university || 'N/A'
    page.drawText(instStr.length > 14 ? `${instStr.slice(0, 14)}..` : instStr, { x: 8, y: gridY - 13, size: 5.5, font: boldFont, color: textDark })

    page.drawText('DEPARTMENT WING', { x: 8, y: gridY - 23, size: 4.5, font: boldFont, color: slateGray })
    const wingStr = profile.wing || 'Technical'
    page.drawText(wingStr.length > 14 ? `${wingStr.slice(0, 14)}..` : wingStr, { x: 8, y: gridY - 31, size: 5.5, font: regularFont, color: textDark })

    // Col 2: Roll No & Stipend
    page.drawText('ROLL / REG NO', { x: 82, y: gridY - 5, size: 4.5, font: boldFont, color: slateGray })
    page.drawText(profile.roll_no || 'N/A', { x: 82, y: gridY - 13, size: 5.5, font: boldFont, color: textDark })

    page.drawText('STIPEND STATUS', { x: 82, y: gridY - 23, size: 4.5, font: boldFont, color: slateGray })
    page.drawText(internship?.internship_type === 'paid' ? 'Paid Category' : 'Unpaid Category', { x: 82, y: gridY - 31, size: 5.5, font: regularFont, color: textDark })

    // Training Period Banner
    const periodY = gridY - 44
    page.drawRectangle({
      x: 8,
      y: periodY - 2,
      width: cardWidth - 16,
      height: 11,
      color: rgb(0.95, 0.97, 0.95),
      borderColor: rgb(0.85, 0.92, 0.88),
      borderWidth: 0.5,
    })

    const fmtD = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'
    const periodStr = `${fmtD(internship?.start_date)} - ${fmtD(internship?.end_date)}`
    page.drawText('TRAINING:', { x: 12, y: periodY + 1, size: 4.5, font: boldFont, color: slateGray })
    page.drawText(periodStr, { x: 50, y: periodY + 1, size: 5.5, font: boldFont, color: emeraldDark })

    // 5. Footer Row: QR Code (Left) & Area Admin Signature (Right)
    const footerTopY = periodY - 10

    // QR Code Generation
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mclportal.vercel.app'
    const verifyUrl = `${baseUrl}/verify/id/${user.id}`
    try {
      const qrPngBuffer = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 80, errorCorrectionLevel: 'M' })
      const qrImg = await pdfDoc.embedPng(qrPngBuffer)
      page.drawImage(qrImg, {
        x: 8,
        y: footerTopY - 32,
        width: 32,
        height: 32,
      })
    } catch (e) {}

    page.drawText('Gate Pass', { x: 42, y: footerTopY - 14, size: 4.5, font: boldFont, color: textDark })
    page.drawText('Scan to verify', { x: 42, y: footerTopY - 20, size: 4, font: regularFont, color: slateGray })

    // Area Admin Signature Embedding
    const sigX = 92
    const sigY = footerTopY - 24
    let embeddedSig = false

    if (signatureData) {
      try {
        const transparentPng = await makeTransparent(signatureData)
        const sigImg = await pdfDoc.embedPng(transparentPng)
        page.drawImage(sigImg, {
          x: sigX,
          y: sigY,
          width: 52,
          height: 18,
        })
        embeddedSig = true
      } catch (e) {
        try {
          const rawBase64 = signatureData.includes(',') ? signatureData.split(',')[1] : signatureData
          const sigBuffer = Buffer.from(rawBase64.trim(), 'base64')
          const sigImg = await pdfDoc.embedPng(sigBuffer)
          page.drawImage(sigImg, { x: sigX, y: sigY, width: 52, height: 18 })
          embeddedSig = true
        } catch (_) {}
      }
    }

    // Fallback GM signature if no area admin signature embedded
    if (!embeddedSig && fs.existsSync(logoPath)) {
      const gmPath = path.join(process.cwd(), 'public', 'gm-signature.png')
      if (fs.existsSync(gmPath)) {
        try {
          const gmBytes = fs.readFileSync(gmPath)
          const gmImg = await pdfDoc.embedPng(gmBytes)
          page.drawImage(gmImg, { x: sigX, y: sigY, width: 52, height: 18 })
        } catch (e) {}
      }
    }

    // Signature line & title
    page.drawLine({
      start: { x: sigX - 4, y: sigY - 2 },
      end: { x: cardWidth - 8, y: sigY - 2 },
      thickness: 0.5,
      color: slateGray,
    })

    page.drawText(areaAdminName.length > 18 ? `${areaAdminName.slice(0, 18)}..` : areaAdminName, {
      x: sigX - 4,
      y: sigY - 7,
      size: 4.5,
      font: boldFont,
      color: textDark,
    })
    page.drawText('Area Training Officer, MCL', {
      x: sigX - 4,
      y: sigY - 12,
      size: 4,
      font: regularFont,
      color: slateGray,
    })

    // 6. Security Bottom Strip
    page.drawRectangle({
      x: 0,
      y: 0,
      width: cardWidth,
      height: 10,
      color: darkBg,
    })
    page.drawText('System Generated Official Trainee ID • Property of MCL HRD', {
      x: 8,
      y: 3,
      size: 3.8,
      font: monoFont,
      color: rgb(0.7, 0.75, 0.8),
    })

    const pdfBytes = await pdfDoc.save()
    const uint8 = new Uint8Array(pdfBytes)

    const cleanFilename = `${(profile.full_name || 'Intern').replace(/[^a-zA-Z0-9]/g, '_')}_MCL_ID_Card.pdf`

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${cleanFilename}"`,
        'Content-Length': String(uint8.byteLength),
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err: any) {
    console.error('[GENERATE-ID-CARD-PDF] Error:', err.message || err)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
