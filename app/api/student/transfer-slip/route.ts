import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const targetStudentId = searchParams.get('student_id') || user.id

    const adminClient = createAdminClient()

    // 1. Fetch student profile
    const { data: student } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', targetStudentId)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
    }

    // 2. Fetch transfer application record to get origin area & referrer admin
    const { data: appRecord } = await adminClient
      .from('applications')
      .select(`
        *,
        referrer:profiles!applications_referred_by_fkey(full_name, area, signature_data)
      `)
      .eq('student_id', targetStudentId)
      .maybeSingle()

    // 3. Fetch Area Admin signature for target or origin area
    let adminSignatureData = appRecord?.referrer?.signature_data || null
    let adminName = appRecord?.referrer?.full_name || 'Area Training Officer / GM (HRD)'
    let originArea = appRecord?.referrer?.area || 'Talcher Area'

    if (!adminSignatureData) {
      // Query any Area Admin for the student's area
      const { data: areaAdmin } = await adminClient
        .from('profiles')
        .select('full_name, signature_data')
        .eq('role', 'admin')
        .eq('area', student.area)
        .not('signature_data', 'is', null)
        .maybeSingle()

      if (areaAdmin) {
        adminSignatureData = areaAdmin.signature_data
        adminName = areaAdmin.full_name
      }
    }

    // Generate PDF Document using pdf-lib
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4 Page Size
    const { width, height } = page.getSize()

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const darkGreen = rgb(0.04, 0.35, 0.22)
    const charcoal = rgb(0.12, 0.16, 0.22)
    const borderGray = rgb(0.85, 0.88, 0.90)

    // Outer Border Frame
    page.drawRectangle({
      x: 25,
      y: 25,
      width: width - 50,
      height: height - 50,
      borderColor: darkGreen,
      borderWidth: 2,
    })

    // Header Title
    page.drawText('MAHANADI COALFIELDS LIMITED', {
      x: 130,
      y: height - 70,
      size: 18,
      font: fontBold,
      color: darkGreen,
    })

    page.drawText('(A Subsidiary of Coal India Limited • HRD Department)', {
      x: 145,
      y: height - 88,
      size: 10,
      font: fontRegular,
      color: charcoal,
    })

    page.drawText('INTER-AREA INTERNSHIP TRANSFER ORDER & RELIEVING SLIP', {
      x: 85,
      y: height - 120,
      size: 12,
      font: fontBold,
      color: darkGreen,
    })

    // Divider Line
    page.drawLine({
      start: { x: 40, y: height - 135 },
      end: { x: width - 40, y: height - 135 },
      thickness: 1,
      color: borderGray,
    })

    const transferRef = `MCL/HRD/X-TRANSFER/${new Date().getFullYear()}/${student.id.slice(0, 6).toUpperCase()}`
    const transferDate = appRecord?.applied_at
      ? new Date(appRecord.applied_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

    page.drawText(`Ref. No: ${transferRef}`, { x: 45, y: height - 160, size: 9, font: fontBold, color: charcoal })
    page.drawText(`Date: ${transferDate}`, { x: width - 170, y: height - 160, size: 9, font: fontBold, color: charcoal })

    // Details Container Card
    const cardTop = height - 180
    page.drawRectangle({
      x: 40,
      y: cardTop - 190,
      width: width - 80,
      height: 180,
      borderColor: borderGray,
      borderWidth: 1,
      color: rgb(0.98, 0.99, 0.98),
    })

    const details = [
      ['Student Name:', student.full_name || 'N/A'],
      ['Email Address:', student.email || 'N/A'],
      ['Academic Wing / Branch:', student.wing || 'Technical'],
      ['University / Institute:', student.university || 'Recognized Technical Institution'],
      ['Origin Area Office:', `${originArea} Training Office`],
      ['Transferred Target Area:', `${student.area || 'Target'} Training Area Office`],
      ['Transfer Order Status:', appRecord?.status === 'approved' ? 'APPROVED & ENROLLED' : 'FORWARDED & UNDER PROCESS'],
    ]

    let currY = cardTop - 25
    details.forEach(([label, val]) => {
      page.drawText(label, { x: 55, y: currY, size: 10, font: fontBold, color: darkGreen })
      page.drawText(val, { x: 220, y: currY, size: 10, font: fontRegular, color: charcoal })
      currY -= 22
    })

    // Official Relieving & Transfer Body Text
    page.drawText('OFFICIAL TRANSFER & RELIEVING ORDERS', {
      x: 45,
      y: height - 400,
      size: 11,
      font: fontBold,
      color: darkGreen,
    })

    const bodyParagraphs = [
      `1. The internship training application and Letter of Recommendation (LoR) for ${student.full_name} have been formally evaluated and transferred from ${originArea} Area to ${student.area} Area Office.`,
      `2. The academic department/wing "${student.wing || 'Technical'}" is verified to be actively operational at ${student.area} Area under MCL HRD guidelines.`,
      `3. The candidate is hereby relieved from ${originArea} Area and directed to report to the Area Training Officer / Assigned Mentor at ${student.area} Area Office for document verification and daily logbook commencement.`
    ]

    let pY = height - 425
    bodyParagraphs.forEach(pText => {
      page.drawText(pText, { x: 45, y: pY, size: 9, font: fontRegular, color: charcoal, maxWidth: width - 90, lineHeight: 13 })
      pY -= 35
    })

    // Embed Saved Digital Signature of Area Admin
    if (adminSignatureData && adminSignatureData.startsWith('data:image')) {
      try {
        const base64Data = adminSignatureData.split(',')[1]
        const imageBytes = Buffer.from(base64Data, 'base64')
        const sigImage = await pdfDoc.embedPng(imageBytes)
        const sigDims = sigImage.scale(0.35)

        page.drawImage(sigImage, {
          x: width - 200,
          y: 110,
          width: Math.min(sigDims.width, 140),
          height: Math.min(sigDims.height, 45),
        })
      } catch (err) {
        console.warn('Could not embed custom base64 signature, using text signature fallback:', err)
      }
    }

    // Signature Block
    page.drawLine({
      start: { x: width - 220, y: 105 },
      end: { x: width - 40, y: 105 },
      thickness: 1,
      color: darkGreen,
    })

    page.drawText(adminName, {
      x: width - 215,
      y: 90,
      size: 10,
      font: fontBold,
      color: darkGreen,
    })

    page.drawText('Area Training Officer / HRD Admin', {
      x: width - 215,
      y: 78,
      size: 8,
      font: fontRegular,
      color: charcoal,
    })

    page.drawText(`Mahanadi Coalfields Limited • ${student.area} Area`, {
      x: width - 215,
      y: 66,
      size: 8,
      font: fontRegular,
      color: charcoal,
    })

    // Footer Security Code
    page.drawText(`System Generated Inter-Area Transfer Order • Digitally Signed & Verified via MCL HRD Portal`, {
      x: 55,
      y: 40,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    })

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="MCL_Transfer_Slip_${student.full_name.replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('Error generating transfer slip PDF:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
