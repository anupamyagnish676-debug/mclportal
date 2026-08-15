import 'regenerator-runtime/runtime'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
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

// Helper to calculate proportional dimensions for signature images
function getScaledDimensions(imgWidth: number, imgHeight: number, targetWidth = 130, targetHeight = 45) {
  const aspect = imgWidth / imgHeight
  let w = targetWidth
  let h = w / aspect
  if (h > targetHeight) {
    h = targetHeight
    w = h * aspect
  }
  return { width: w, height: h }
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
    pdfDoc.registerFontkit(fontkit)

    let fontDevanagari: any = null
    try {
      const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Hind-Regular.ttf')
      if (fs.existsSync(fontPath)) {
        const fontBytes = fs.readFileSync(fontPath)
        fontDevanagari = await pdfDoc.embedFont(fontBytes)
      }
    } catch (fontErr) {
      console.warn('Could not load Devanagari font:', fontErr)
    }

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
    const refNo = `Ref: MCL/${areaName.toUpperCase()}/INT/${new Date().getFullYear()}/${serialNo}`
    const todayStr = `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`
    
    page.drawText(refNo, { x: width - 210, y: height - 62, size: 8, font: fontRegular, color: charcoal })
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
    page.drawText('To,', { x: 45, y: height - 160, size: 10, font: fontRegular, color: charcoal })
    
    let currentY = height - 173
    const toDetails = [
      student.full_name,
      `University: ${student.university || 'N/A'}`,
      `Roll / Reg No: ${student.roll_no || 'N/A'}`
    ]
    toDetails.forEach(line => {
      page.drawText(sanitizeText(line), { x: 55, y: currentY, size: 9.5, font: fontBold, color: charcoal })
      currentY -= 13
    })

    // Body Text
    const bodyText = `With reference to the Letter of Recommendation submitted on your behalf, we are pleased to confirm that you have been approved and allocated to undergo internship training at Mahanadi Coalfields Limited (MCL). Your training profile details are outlined below:`
    page.drawText(bodyText, {
      x: 45,
      y: currentY - 8,
      size: 9,
      font: fontRegular,
      color: charcoal,
      maxWidth: width - 90,
      lineHeight: 13,
    })

    // Table Box
    const tableTop = currentY - 45
    page.drawRectangle({
      x: 45,
      y: tableTop - 95,
      width: width - 90,
      height: 95,
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

    let rowY = tableTop - 18
    rows.forEach(([label, val]) => {
      page.drawText(label, { x: 55, y: rowY, size: 8.5, font: fontBold, color: darkGreen })
      page.drawText(sanitizeText(val), { x: 220, y: rowY, size: 8.5, font: fontRegular, color: charcoal })
      if (rowY > tableTop - 85) {
        page.drawLine({
          start: { x: 45, y: rowY - 5 },
          end: { x: width - 45, y: rowY - 5 },
          thickness: 0.5,
          color: borderGray,
        })
      }
      rowY -= 18
    })

    // Terms and conditions header
    let termsY = tableTop - 118
    page.drawText('TRAINING TERMS & CONDITIONS', {
      x: 45,
      y: termsY,
      size: 9.5,
      font: fontBold,
      color: darkGreen,
    })

    if (fontDevanagari) {
      termsY -= 13
      page.drawText('निम्नलिखित नियम एवं शर्तों के आधार पर छात्र को निःशुल्क प्रशिक्षण दिया जा रहा है:-', {
        x: 45,
        y: termsY,
        size: 7.5,
        font: fontDevanagari,
        color: charcoal,
      })
    }

    termsY -= 11
    page.drawText('Training is being given to the student on the basis of the following terms and conditions:-', {
      x: 45,
      y: termsY,
      size: 7.5,
      font: fontBold,
      color: charcoal,
    })

    const terms = [
      {
        hi: '1. छात्र द्वारा एकत्रित की गई जानकारी का उपयोग केवल शैक्षणिक उद्देश्य के लिए किया जाएगा।',
        en: '   The information collected by the student will be used only for educational purpose.'
      },
      {
        hi: '2. प्रशिक्षण अवधि के दौरान छात्र को हुई किसी भी चोट/दुर्घटना के लिए कंपनी जिम्मेदार नहीं होगी।',
        en: '   The Company will not be responsible for any injury/accident caused to the student during the training period.'
      },
      {
        hi: '3. कंपनी द्वारा छात्र को कोई आवास और परिवहन प्रदान नहीं किया जाएगा।',
        en: '   No accommodation and transportation will be provided to the student by the company.'
      },
      {
        hi: '4. प्रशिक्षण उनके अपने जोखिम पर होगा। यदि प्रशिक्षण के दौरान कुछ होता है, तो कंपनी जिम्मेदार नहीं होगी। छात्र को इस आशय का एक वचन पत्र प्रस्तुत करना होगा।',
        en: '   The training will be at their own risk, if anything happens during their training period, the company will not be responsible. The student will have to submit an undertaking to this effect.'
      },
      {
        hi: '5. एमसीएल द्वारा कोई वित्तीय भार वहन नहीं किया जाएगा।',
        en: '   No financial burden will be borne by MCL.'
      },
      {
        hi: '6. संबंधित क्षेत्र/परियोजना/विभाग द्वारा लगाई गई कोई अन्य शर्तें।',
        en: '   Any other conditions imposed by the concerned sector/project/department.'
      }
    ]

    termsY -= 13
    terms.forEach(term => {
      if (fontDevanagari && term.hi) {
        page.drawText(term.hi, {
          x: 45,
          y: termsY,
          size: 7,
          font: fontDevanagari,
          color: charcoal,
          maxWidth: width - 90,
          lineHeight: 9,
        })
        termsY -= 10
      }
      page.drawText(term.en, {
        x: 45,
        y: termsY,
        size: 7,
        font: fontRegular,
        color: charcoal,
        maxWidth: width - 90,
        lineHeight: 9,
      })
      termsY -= 13
    })

    // Reporting Advisory Box
    const advisoryY = termsY - 8
    page.drawRectangle({
      x: 45,
      y: advisoryY - 45,
      width: width - 90,
      height: 45,
      borderColor: rgb(0.92, 0.75, 0.75),
      borderWidth: 1,
      color: rgb(0.99, 0.97, 0.97),
    })

    page.drawText('REPORTING ADVISORY / रिपोर्टिंग निर्देश:', {
      x: 55,
      y: advisoryY - 13,
      size: 7.5,
      font: fontDevanagari || fontBold,
      color: rgb(0.6, 0.1, 0.1),
    })

    if (fontDevanagari) {
      const hindiAdv = `आपसे अनुरोध है कि उपरोक्त छात्र को आगे की आवश्यक कार्रवाई के लिए अपने पहचान पत्र के साथ उपरोक्त तिथि के अनुसार General Manager, ${areaName} Area, MCL को रिपोर्ट करने की सलाह दें।`
      page.drawText(hindiAdv, {
        x: 55,
        y: advisoryY - 24,
        size: 7,
        font: fontDevanagari,
        color: charcoal,
        maxWidth: width - 110,
        lineHeight: 9,
      })
    }

    const advisoryText = `You are requested to advise the above students to report to the General Manager, ${areaName} Area, MCL HQ as per the above date along with his identity card for further necessary action.`
    page.drawText(sanitizeText(advisoryText), {
      x: 55,
      y: fontDevanagari ? advisoryY - 35 : advisoryY - 25,
      size: 7,
      font: fontRegular,
      color: charcoal,
      maxWidth: width - 110,
      lineHeight: 9,
    })

    // Swapped Signature Section
    const footerY = 115

    // Left Column: Area Training Officer
    if (areaAdmin?.signature_data) {
      try {
        let sigImage;
        try {
          const transparentSigBuffer = await makeTransparent(areaAdmin.signature_data)
          sigImage = await pdfDoc.embedPng(transparentSigBuffer)
        } catch (jimpErr) {
          console.warn('Jimp transparency processing failed for Area Admin, embedding signature directly:', jimpErr)
          const base64Data = areaAdmin.signature_data.includes(',') ? areaAdmin.signature_data.split(',')[1] : areaAdmin.signature_data
          const imageBytes = Buffer.from(base64Data, 'base64')
          sigImage = await pdfDoc.embedPng(imageBytes)
        }
        
        const { width: sigW, height: sigH } = getScaledDimensions(sigImage.width, sigImage.height, 130, 45)
        page.drawImage(sigImage, {
          x: 45,
          y: footerY + 2,
          width: sigW,
          height: sigH,
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
        let sigImage;
        try {
          const transparentSigBuffer = await makeTransparent(hqAdmin.signature_data)
          sigImage = await pdfDoc.embedPng(transparentSigBuffer)
        } catch (jimpErr) {
          console.warn('Jimp transparency processing failed for GM HRD, embedding signature directly:', jimpErr)
          const base64Data = hqAdmin.signature_data.includes(',') ? hqAdmin.signature_data.split(',')[1] : hqAdmin.signature_data
          const imageBytes = Buffer.from(base64Data, 'base64')
          sigImage = await pdfDoc.embedPng(imageBytes)
        }
        
        const { width: sigW, height: sigH } = getScaledDimensions(sigImage.width, sigImage.height, 130, 45)
        page.drawImage(sigImage, {
          x: width - 185,
          y: footerY + 2,
          width: sigW,
          height: sigH,
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
