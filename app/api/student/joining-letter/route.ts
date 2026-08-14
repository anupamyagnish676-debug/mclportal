import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'
import { Jimp } from 'jimp'

export const dynamic = 'force-dynamic'

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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // 1. Fetch student profile
    const { data: student } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (!student || student.role !== 'student') {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
    }

    // 2. Fetch active internship
    const { data: internship } = await adminClient
      .from('internships')
      .select('*')
      .eq('student_id', user.id)
      .maybeSingle()

    const serialNo = internship?.serial_no || 'N/A'
    const areaName = student.area || 'Concerned'
    
    const startDate = internship?.start_date 
      ? new Date(internship.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) 
      : 'N/A'
    const endDate = internship?.end_date 
      ? new Date(internship.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) 
      : 'N/A'
    
    // Fetch HQ Admin (GM HRD) signature
    const { data: hqAdmin } = await adminClient
      .from('profiles')
      .select('full_name, signature_data')
      .eq('email', 'anupamyagnish87@gmail.com')
      .maybeSingle()

    // Fetch Area Admin (Area Training Officer) signature
    const { data: areaAdmins } = await adminClient
      .from('profiles')
      .select('full_name, signature_data')
      .eq('role', 'admin')
      .eq('area', areaName)
      .not('signature_data', 'is', null)
      .limit(1)

    const areaAdmin = areaAdmins?.[0] || null

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
      x: 30,
      y: 30,
      width: width - 60,
      height: height - 60,
      borderColor: darkGreen,
      borderWidth: 1.5,
    })

    // Embed MCL Logo
    try {
      const logoPath = path.join(process.cwd(), 'public', 'mcl-logo-transparent.png')
      const logoBytes = fs.readFileSync(logoPath)
      const logoImage = await pdfDoc.embedPng(logoBytes)
      page.drawImage(logoImage, {
        x: 50,
        y: height - 95,
        width: 50,
        height: 50,
      })
    } catch (e) {
      console.warn('Could not embed MCL logo:', e)
    }

    // Header Title
    page.drawText('MAHANADI COALFIELDS LIMITED', {
      x: 115,
      y: height - 62,
      size: 15,
      font: fontBold,
      color: darkGreen,
    })

    page.drawText('(A Subsidiary of Coal India Limited • HRD Department)', {
      x: 115,
      y: height - 76,
      size: 8.5,
      font: fontRegular,
      color: charcoal,
    })

    page.drawText(`Office of the General Manager, ${sanitizeText(areaName)} Area Office`, {
      x: 115,
      y: height - 88,
      size: 8.5,
      font: fontRegular,
      color: charcoal,
    })

    // Ref & Date
    const refNo = `Ref: MCL/${areaName.toUpperCase()}/INT/${new Date().getFullYear()}/{serialNo}`
    const refText = refNo.replace('{serialNo}', serialNo)
    const todayStr = `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`
    
    page.drawText(refText, { x: width - 210, y: height - 62, size: 8, font: fontRegular, color: charcoal })
    page.drawText(todayStr, { x: width - 210, y: height - 76, size: 8, font: fontRegular, color: charcoal })

    // Divider Line
    page.drawLine({
      start: { x: 45, y: height - 110 },
      end: { x: width - 45, y: height - 110 },
      thickness: 1,
      color: darkGreen,
    })

    // Sub-header
    page.drawText('OFFICIAL INTERNSHIP JOINING & ALLOCATION ORDER', {
      x: 120,
      y: height - 135,
      size: 11,
      font: fontBold,
      color: darkGreen,
    })

    // To section
    page.drawText('To,', { x: 45, y: height - 165, size: 10, font: fontRegular, color: charcoal })
    
    let currentY = height - 180
    const toDetails = [
      student.full_name,
      `University: ${student.university || 'N/A'}`,
      `Roll / Reg No: ${student.roll_no || 'N/A'}`
    ]
    toDetails.forEach(line => {
      page.drawText(sanitizeText(line), { x: 55, y: currentY, size: 10, font: fontBold, color: charcoal })
      currentY -= 14
    })

    // Body Text
    const bodyText = `With reference to the Letter of Recommendation submitted on your behalf, we are pleased to confirm that you have been approved and allocated to undergo internship training at Mahanadi Coalfields Limited (MCL). Your training profile details are outlined below:`
    page.drawText(bodyText, {
      x: 45,
      y: currentY - 10,
      size: 9.5,
      font: fontRegular,
      color: charcoal,
      maxWidth: width - 90,
      lineHeight: 14,
    })

    // Table Box
    const tableTop = currentY - 50
    page.drawRectangle({
      x: 45,
      y: tableTop - 110,
      width: width - 90,
      height: 110,
      borderColor: borderGray,
      borderWidth: 1,
      color: rgb(0.98, 0.99, 0.98),
    })

    const rows = [
      ['Internship Serial Number', `MCL/HRD/${areaName.toUpperCase()}/${serialNo}`],
      ['Training Allocated Area', `${areaName} Area Office, MCL`],
      ['Allocated Department', student.wing || 'Technical Wing'],
      ['Training Period Range', `${startDate} to ${endDate}`],
      ['Stipend Designation', internship?.internship_type === 'paid' ? 'Paid Internship' : 'Unpaid Training'],
    ]

    let rowY = tableTop - 20
    rows.forEach(([label, val]) => {
      page.drawText(label, { x: 60, y: rowY, size: 9, font: fontBold, color: darkGreen })
      page.drawText(sanitizeText(val), { x: 230, y: rowY, size: 9, font: fontRegular, color: charcoal })
      // Divider
      if (rowY > tableTop - 100) {
        page.drawLine({
          start: { x: 45, y: rowY - 6 },
          end: { x: width - 45, y: rowY - 6 },
          thickness: 0.5,
          color: borderGray,
        })
      }
      rowY -= 20
    })

    // Terms and conditions header
    let termsY = tableTop - 140
    page.drawText('TRAINING TERMS & CONDITIONS', {
      x: 45,
      y: termsY,
      size: 10,
      font: fontBold,
      color: darkGreen,
    })

    const terms = [
      '1. The information collected by the student will be used only for educational purpose.',
      '2. The Company will not be responsible for any injury/accident caused to the student during the training period.',
      '3. No accommodation and transportation will be provided to the student by the company.',
      '4. The training will be at their own risk. If anything happens during their training period, the company will not be responsible. The student must submit an undertaking to this effect.',
      '5. No financial burden will be borne by MCL (except stipulated stipend amounts for approved paid category).',
      '6. Any other conditions imposed by the concerned sector/project/department.',
      '7. The Student is advised to take a printout of this letter and report.'
    ]

    termsY -= 15
    terms.forEach(term => {
      page.drawText(term, {
        x: 45,
        y: termsY,
        size: 8.5,
        font: fontRegular,
        color: charcoal,
        maxWidth: width - 90,
        lineHeight: 12,
      })
      termsY -= 24
    })

    // Reporting Advisory Box
    const advisoryY = termsY - 10
    page.drawRectangle({
      x: 45,
      y: advisoryY - 45,
      width: width - 90,
      height: 45,
      borderColor: rgb(0.92, 0.75, 0.75),
      borderWidth: 1,
      color: rgb(0.99, 0.97, 0.97),
    })

    page.drawText('REPORTING ADVISORY:', {
      x: 55,
      y: advisoryY - 15,
      size: 8.5,
      font: fontBold,
      color: rgb(0.6, 0.1, 0.1),
    })

    const advisoryText = `You are requested to advise the student to report to the General Manager, ${areaName} Area, MCL as per the allocated date along with their identity card for further necessary action.`
    page.drawText(sanitizeText(advisoryText), {
      x: 55,
      y: advisoryY - 27,
      size: 8,
      font: fontRegular,
      color: charcoal,
      maxWidth: width - 110,
      lineHeight: 11,
    })

    // Swapped Signature Section
    const footerY = 120

    // Left Column: Area Training Officer
    if (areaAdmin?.signature_data) {
      try {
        const transparentSigBuffer = await makeTransparent(areaAdmin.signature_data)
        const sigImage = await pdfDoc.embedPng(transparentSigBuffer)
        const sigDims = sigImage.scale(0.35)
        page.drawImage(sigImage, {
          x: 45,
          y: footerY,
          width: Math.min(sigDims.width, 140),
          height: Math.min(sigDims.height, 45),
        })
      } catch (e) {
        console.warn('Could not embed Area Training Officer signature in PDF:', e)
      }
    }

    page.drawLine({ start: { x: 45, y: footerY - 5 }, end: { x: 200, y: footerY - 5 }, thickness: 1, color: darkGreen })
    page.drawText('Area Training Officer', { x: 45, y: footerY - 18, size: 9, font: fontBold, color: darkGreen })
    page.drawText(`Mahanadi Coalfields Limited, ${sanitizeText(areaName)} Area`, { x: 45, y: footerY - 30, size: 8, font: fontRegular, color: charcoal })

    // Right Column: General Manager (HRD)
    if (hqAdmin?.signature_data) {
      try {
        const transparentSigBuffer = await makeTransparent(hqAdmin.signature_data)
        const sigImage = await pdfDoc.embedPng(transparentSigBuffer)
        const sigDims = sigImage.scale(0.35)
        page.drawImage(sigImage, {
          x: width - 185,
          y: footerY,
          width: Math.min(sigDims.width, 140),
          height: Math.min(sigDims.height, 45),
        })
      } catch (e) {
        console.warn('Could not embed GM HRD signature in PDF:', e)
      }
    }

    page.drawLine({ start: { x: width - 200, y: footerY - 5 }, end: { x: width - 45, y: footerY - 5 }, thickness: 1, color: darkGreen })
    page.drawText('General Manager (HRD)', { x: width - 200, y: footerY - 18, size: 9, font: fontBold, color: darkGreen })
    page.drawText('Mahanadi Coalfields Limited', { x: width - 200, y: footerY - 30, size: 8, font: fontRegular, color: charcoal })

    // Security Disclaimer Footer
    page.drawText('System Generated Official Joining Letter • Digitally Signed & Verified via MCL HRD Portal', {
      x: 45,
      y: 40,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    })

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="MCL_Joining_Letter_${student.full_name.replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('Error generating joining letter PDF:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
