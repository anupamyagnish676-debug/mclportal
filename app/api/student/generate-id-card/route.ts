import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'
import { Jimp } from 'jimp'
import { getGDriveFileBuffer } from '@/lib/gdrive'

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

// Helper to fetch passport photo buffer directly
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
      return await getGDriveFileBuffer(fileId)
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
    console.error('[ID-CARD-PDF] Photo fetch error:', e)
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

    // Fetch active internship
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

    // Standard ISO CR80 Landscape Dimensions in Points (72 dpi)
    // 85.60 mm = 242.65 pt (Width), 53.98 mm = 153.01 pt (Height)
    const cardWidth = 242.65
    const cardHeight = 153.01

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([cardWidth, cardHeight])

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const monoFont = await pdfDoc.embedFont(StandardFonts.CourierBold)

    // Palette
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

    // 2. Header Box (Top 26 pt)
    const headerHeight = 26
    const headerY = cardHeight - headerHeight

    page.drawRectangle({
      x: 0,
      y: headerY,
      width: cardWidth,
      height: headerHeight,
      color: headerBg,
    })

    // Header Bottom Line
    page.drawLine({
      start: { x: 0, y: headerY },
      end: { x: cardWidth, y: headerY },
      thickness: 1.5,
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
          width: 18,
          height: 18,
        })
      } catch (e) {}
    }

    // Header Text
    page.drawText('MAHANADI COALFIELDS LIMITED', {
      x: 28,
      y: headerY + 14,
      size: 7,
      font: boldFont,
      color: emeraldDark,
    })
    page.drawText('(A Subsidiary of Coal India Limited)', {
      x: 28,
      y: headerY + 6,
      size: 4.8,
      font: regularFont,
      color: slateGray,
    })

    // INTERN ID Badge
    page.drawRectangle({
      x: cardWidth - 44,
      y: headerY + 7,
      width: 38,
      height: 12,
      color: amberAccent,
    })
    page.drawText('INTERN ID', {
      x: cardWidth - 40,
      y: headerY + 10.5,
      size: 5,
      font: boldFont,
      color: rgb(0.2, 0.1, 0),
    })

    // 3. Passport Photo (Left Column)
    const photoWidth = 52
    const photoHeight = 66
    const photoX = 8
    const photoY = 44

    page.drawRectangle({
      x: photoX - 1,
      y: photoY - 1,
      width: photoWidth + 2,
      height: photoHeight + 2,
      color: rgb(1, 1, 1),
      borderColor: emeraldDark,
      borderWidth: 1.5,
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
        page.drawRectangle({ x: photoX, y: photoY, width: photoWidth, height: photoHeight, color: rgb(0.95, 0.96, 0.98) })
      }
    } else {
      page.drawRectangle({ x: photoX, y: photoY, width: photoWidth, height: photoHeight, color: rgb(0.95, 0.96, 0.98) })
      page.drawText('NO PHOTO', { x: photoX + 10, y: photoY + 30, size: 6, font: boldFont, color: slateGray })
    }

    // 4. Middle Column: Student Information (X = 68 to 175)
    const midX = 68

    // Trainee Name
    page.drawText('TRAINEE NAME', { x: midX, y: 116, size: 4.5, font: boldFont, color: slateGray })
    const studentNameStr = (profile.full_name || 'STUDENT').toUpperCase()
    page.drawText(studentNameStr.length > 20 ? `${studentNameStr.slice(0, 20)}..` : studentNameStr, {
      x: midX,
      y: 106,
      size: 8,
      font: boldFont,
      color: emeraldDark,
    })

    // Serial Number
    page.drawText('SERIAL NO.', { x: midX, y: 96, size: 4.5, font: boldFont, color: slateGray })
    const serialStr = `MCL/HRD/${(areaName || 'HQ').toUpperCase()}/${serialNo}`
    page.drawText(serialStr, {
      x: midX,
      y: 88,
      size: 6,
      font: monoFont,
      color: textDark,
    })

    // Allocated Area
    page.drawText('ALLOCATED AREA', { x: midX, y: 78, size: 4.5, font: boldFont, color: slateGray })
    page.drawText(`${areaName} Area Office`, {
      x: midX,
      y: 70,
      size: 6.5,
      font: boldFont,
      color: emeraldDark,
    })

    // Secondary Details Row: Inst & Roll
    const instStr = profile.university || 'N/A'
    const rollStr = profile.roll_no || 'N/A'
    page.drawText(`INST: ${instStr.length > 13 ? instStr.slice(0, 13) + '.' : instStr}`, { x: midX, y: 58, size: 5.5, font: regularFont, color: textDark })
    page.drawText(`ROLL: ${rollStr}`, { x: midX + 60, y: 58, size: 5.5, font: boldFont, color: textDark })

    // Secondary Details Row: Wing & Stipend
    const wingStr = profile.wing || 'Technical'
    const stipendStr = internship?.internship_type === 'paid' ? 'Paid' : 'Unpaid'
    page.drawText(`WING: ${wingStr}`, { x: midX, y: 48, size: 5.5, font: regularFont, color: textDark })
    page.drawText(`STIPEND: ${stipendStr}`, { x: midX + 60, y: 48, size: 5.5, font: regularFont, color: textDark })

    // Training Period Highlight Strip
    page.drawRectangle({
      x: midX,
      y: 32,
      width: 104,
      height: 11,
      color: rgb(0.94, 0.97, 0.94),
      borderColor: rgb(0.82, 0.91, 0.84),
      borderWidth: 0.5,
    })
    const fmtD = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'
    const periodStr = `${fmtD(internship?.start_date)} - ${fmtD(internship?.end_date)}`
    page.drawText('TRAINING:', { x: midX + 3, y: 35, size: 4.5, font: boldFont, color: slateGray })
    page.drawText(periodStr, { x: midX + 34, y: 35, size: 5.5, font: boldFont, color: emeraldDark })


    // 5. Right Column: QR Code & Signature (X = 180 to cardWidth - 8)
    const rightX = 184

    // QR Code
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mclportal.vercel.app'
    const verifyUrl = `${baseUrl}/verify/id/${user.id}`
    try {
      const qrPngBuffer = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 100, errorCorrectionLevel: 'M' })
      const qrImg = await pdfDoc.embedPng(qrPngBuffer)
      page.drawImage(qrImg, {
        x: rightX,
        y: 72,
        width: 50,
        height: 50,
      })
    } catch (e) {}

    page.drawText('Digital Gate Pass', { x: rightX + 2, y: 64, size: 4.5, font: boldFont, color: textDark })
    page.drawText('Scan to verify', { x: rightX + 5, y: 58, size: 4, font: regularFont, color: slateGray })

    // Area Admin Signature (Preserving Natural Aspect Ratio)
    let embeddedSig = false
    const maxSigW = 52
    const maxSigH = 22
    const sigTargetY = 32

    if (signatureData) {
      try {
        const transparentPng = await makeTransparent(signatureData)
        const sigImg = await pdfDoc.embedPng(transparentPng)
        const scale = Math.min(maxSigW / sigImg.width, maxSigH / sigImg.height)
        const finalW = sigImg.width * scale
        const finalH = sigImg.height * scale

        page.drawImage(sigImg, {
          x: rightX + (maxSigW - finalW) / 2,
          y: sigTargetY + (maxSigH - finalH) / 2,
          width: finalW,
          height: finalH,
        })
        embeddedSig = true
      } catch (e) {
        try {
          const rawBase64 = signatureData.includes(',') ? signatureData.split(',')[1] : signatureData
          const sigBuffer = Buffer.from(rawBase64.trim(), 'base64')
          const sigImg = await pdfDoc.embedPng(sigBuffer)
          const scale = Math.min(maxSigW / sigImg.width, maxSigH / sigImg.height)
          const finalW = sigImg.width * scale
          const finalH = sigImg.height * scale

          page.drawImage(sigImg, {
            x: rightX + (maxSigW - finalW) / 2,
            y: sigTargetY + (maxSigH - finalH) / 2,
            width: finalW,
            height: finalH,
          })
          embeddedSig = true
        } catch (_) {}
      }
    }

    // Fallback GM signature if no area admin signature embedded
    if (!embeddedSig) {
      const gmPath = path.join(process.cwd(), 'public', 'gm-signature.png')
      if (fs.existsSync(gmPath)) {
        try {
          const gmBytes = fs.readFileSync(gmPath)
          const gmImg = await pdfDoc.embedPng(gmBytes)
          const scale = Math.min(maxSigW / gmImg.width, maxSigH / gmImg.height)
          const finalW = gmImg.width * scale
          const finalH = gmImg.height * scale

          page.drawImage(gmImg, {
            x: rightX + (maxSigW - finalW) / 2,
            y: sigTargetY + (maxSigH - finalH) / 2,
            width: finalW,
            height: finalH,
          })
        } catch (e) {}
      }
    }

    // Signature underline & Title
    page.drawLine({
      start: { x: rightX - 2, y: sigTargetY - 1 },
      end: { x: cardWidth - 8, y: sigTargetY - 1 },
      thickness: 0.5,
      color: slateGray,
    })

    page.drawText(areaAdminName.length > 16 ? `${areaAdminName.slice(0, 16)}..` : areaAdminName, {
      x: rightX - 2,
      y: sigTargetY - 7,
      size: 4.5,
      font: boldFont,
      color: textDark,
    })
    page.drawText('Area Training Officer', {
      x: rightX - 2,
      y: sigTargetY - 12,
      size: 4,
      font: regularFont,
      color: slateGray,
    })

    // 6. Security Bottom Strip
    page.drawRectangle({
      x: 0,
      y: 0,
      width: cardWidth,
      height: 11,
      color: darkBg,
    })
    page.drawText('System Generated Official Trainee ID • Property of MCL HRD', {
      x: 12,
      y: 3.5,
      size: 4.2,
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
