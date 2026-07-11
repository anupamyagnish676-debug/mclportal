import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createHmac } from 'crypto'
import QRCode from 'qrcode'
import { Jimp } from 'jimp'
import fs from 'fs'
import path from 'path'

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

// Convert numbers to words (Rupees)
function numberToWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  
  if (num === 0) return 'Zero'
  
  const g = (n: number): string => {
    if (n < 20) return a[n]
    const digit = n % 10
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '')
    const h = Math.floor(n / 100)
    const rem = n % 100
    return a[h] + ' Hundred' + (rem ? ' and ' + g(rem) : '')
  }
  
  const convert = (n: number): string => {
    let parts = []
    if (n >= 10000000) {
      parts.push(convert(Math.floor(n / 10000000)) + ' Crore')
      n %= 10000000
    }
    if (n >= 100000) {
      parts.push(g(Math.floor(n / 100000)) + ' Lakh')
      n %= 100000
    }
    if (n >= 1000) {
      parts.push(g(Math.floor(n / 1000)) + ' Thousand')
      n %= 1000
    }
    if (n > 0) {
      parts.push(g(n))
    }
    return parts.join(' ')
  }
  
  return convert(num)
}

interface PaySlipData {
  paymentId: string
  studentName: string
  university: string
  wing: string
  serialNo: string | number
  startDate: string
  endDate: string
  periodLabel: string
  amount: number
  bankName: string
  accountNo: string
  ifscCode: string
  utr: string
  disbursedAt: string
  financeOfficerName: string
  financeOfficerSignature?: string | null
  origin: string
}

export async function generatePaySlip(data: PaySlipData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // Portrait A4
  const { width, height } = page.getSize()

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // 1. Draw Cream Background
  page.drawRectangle({
    x: 15,
    y: 15,
    width: width - 30,
    height: height - 30,
    color: rgb(0.99, 0.99, 0.97)
  })

  // 2. Double Border
  // Outer Green
  page.drawRectangle({
    x: 15,
    y: 15,
    width: width - 30,
    height: height - 30,
    borderColor: rgb(0.06, 0.35, 0.18),
    borderWidth: 4
  })
  // Inner Gold
  page.drawRectangle({
    x: 23,
    y: 23,
    width: width - 46,
    height: height - 46,
    borderColor: rgb(0.76, 0.6, 0.21),
    borderWidth: 1
  })

  // 3. Load & Draw Logos
  // Left Logo: Ministry of Coal
  const ministryLogoPath = path.join(process.cwd(), 'public', 'ministry-of-coal-logo.png')
  let ministryLogoImg: any = null
  try {
    if (fs.existsSync(ministryLogoPath)) {
      const bytes = fs.readFileSync(ministryLogoPath)
      ministryLogoImg = await pdfDoc.embedPng(bytes)
    }
  } catch (e) {
    console.error('Failed to embed Ministry of Coal logo on payslip:', e)
  }

  if (ministryLogoImg) {
    page.drawImage(ministryLogoImg, {
      x: 40,
      y: height - 85,
      width: 70,
      height: 40
    })
  }

  // Right Logo: MCL
  const mclLogoPath = path.join(process.cwd(), 'public', 'mcl-logo-new.png')
  let mclLogoImg: any = null
  try {
    if (fs.existsSync(mclLogoPath)) {
      const bytes = fs.readFileSync(mclLogoPath)
      mclLogoImg = await pdfDoc.embedPng(bytes)
    }
  } catch (e) {
    console.error('Failed to embed MCL logo on payslip:', e)
  }

  if (mclLogoImg) {
    page.drawImage(mclLogoImg, {
      x: width - 40 - 70, // 595 - 40 - 70 = 485
      y: height - 85,
      width: 70,
      height: 40
    })
  }

  // 4. Draw Header
  const orgTitle = 'MAHANADI COALFIELDS LIMITED'
  const orgSubText = '(A Subsidiary of Coal India Limited)'
  const deptText = 'Human Resource Development (HRD) Department'
  const docTitle = 'STIPEND PAYMENT ADVICE (PAY SLIP)'

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

  drawCenteredText(orgTitle, height - 55, 14, boldFont, rgb(0.06, 0.35, 0.18))
  drawCenteredText(orgSubText, height - 70, 9, regularFont, rgb(0.4, 0.4, 0.4))
  drawCenteredText(deptText, height - 85, 9, regularFont, rgb(0.4, 0.4, 0.4))
  
  // Header divider
  page.drawLine({
    start: { x: 35, y: height - 100 },
    end: { x: width - 35, y: height - 100 },
    color: rgb(0.76, 0.6, 0.21),
    thickness: 1
  })

  drawCenteredText(docTitle, height - 122, 11, boldFont, rgb(0.1, 0.1, 0.1))

  // 5. Details Content Box
  const boxTop = height - 145
  const boxLeft = 40
  const boxWidth = width - 80
  const boxHeight = 465

  // Draw light gray table box
  page.drawRectangle({
    x: boxLeft,
    y: boxTop - boxHeight,
    width: boxWidth,
    height: boxHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 1
  })

  // Table rows layout helper
  let currentY = boxTop - 25

  const drawRow = (label: string, value: string, isHeader = false) => {
    if (isHeader) {
      page.drawRectangle({
        x: boxLeft + 1,
        y: currentY - 5,
        width: boxWidth - 2,
        height: 22,
        color: rgb(0.95, 0.97, 0.95)
      })
      page.drawText(label.toUpperCase(), {
        x: boxLeft + 15,
        y: currentY,
        size: 9,
        font: boldFont,
        color: rgb(0.06, 0.35, 0.18)
      })
      currentY -= 25
      return
    }

    page.drawText(label, {
      x: boxLeft + 15,
      y: currentY,
      size: 9,
      font: boldFont,
      color: rgb(0.3, 0.3, 0.3)
    })

    // Handle multi-line wrapping for long values (like amount in words or university)
    const maxValWidth = 240
    const words = String(value).split(' ')
    const lines = []
    let currentLine = ''
    for (const w of words) {
      const test = currentLine ? `${currentLine} ${w}` : w
      if (regularFont.widthOfTextAtSize(test, 9) > maxValWidth) {
        lines.push(currentLine)
        currentLine = w
      } else {
        currentLine = test
      }
    }
    if (currentLine) lines.push(currentLine)

    let lineY = currentY
    for (const line of lines) {
      page.drawText(line, {
        x: boxLeft + 200,
        y: lineY,
        size: 9,
        font: regularFont,
        color: rgb(0.1, 0.1, 0.1)
      })
      lineY -= 14
    }

    const rowOffset = Math.max(25, lines.length * 14 + 10)

    // Row divider
    page.drawLine({
      start: { x: boxLeft, y: currentY - rowOffset + 12 },
      end: { x: boxLeft + boxWidth, y: currentY - rowOffset + 12 },
      color: rgb(0.9, 0.9, 0.9),
      thickness: 0.5
    })

    currentY -= rowOffset
  }

  // Section 1: Intern Details
  drawRow('Internship & Intern Details', '', true)
  drawRow('Name of Intern', data.studentName)
  drawRow('Internship Serial ID', `MCL/HRD/INT/${data.serialNo}`)
  drawRow('University / College', data.university)
  drawRow('Wing / Department', data.wing)
  drawRow('Training Period', `${formatDate(data.startDate)} to ${formatDate(data.endDate)}`)

  // Section 2: Stipend details
  drawRow('Stipend Payout & Bank Coordinates', '', true)
  drawRow('Payout Month / Period', data.periodLabel)
  drawRow('Stipend Amount (Paid)', `INR ${data.amount.toFixed(2)}`)
  drawRow('Amount in Words', `Rupees ${numberToWords(Math.floor(data.amount))} Only`)
  const lastFour = data.accountNo ? data.accountNo.slice(-4) : '****'
  drawRow('Bank coordinates', `${data.bankName} (A/C ending ****${lastFour})`)
  drawRow('IFSC Code', data.ifscCode)
  drawRow('Transaction Ref / UTR', data.utr)
  drawRow('Advice Reference ID', data.paymentId)
  drawRow('Status', 'DISBURSED / SUCCESS')
  drawRow('Disbursement Date', formatDate(data.disbursedAt))

  // 6. Signatures and Verification section
  const footerY = 110
  
  // Left: Verification QR code (pointing to payslip authenticity route)
  let qrCodeImg = null
  try {
    const verifyUrl = `${data.origin}/verify/stipend/${data.paymentId}`
    const qrCodeBase64 = await QRCode.toDataURL(verifyUrl, { margin: 2, width: 300, errorCorrectionLevel: 'H' })
    const qrCodePngBytes = Buffer.from(qrCodeBase64.split(',')[1], 'base64')
    qrCodeImg = await pdfDoc.embedPng(qrCodePngBytes)
  } catch (e) {
    console.error('Failed to generate payslip QR:', e)
  }

  if (qrCodeImg) {
    const qrSize = 55
    page.drawRectangle({
      x: 40 - 2,
      y: footerY - 2,
      width: qrSize + 4,
      height: qrSize + 4,
      color: rgb(1, 1, 1)
    })
    page.drawRectangle({
      x: 40 - 2,
      y: footerY - 2,
      width: qrSize + 4,
      height: qrSize + 4,
      borderColor: rgb(0.75, 0.6, 0.21),
      borderWidth: 0.6
    })
    page.drawImage(qrCodeImg, {
      x: 40,
      y: footerY,
      width: qrSize,
      height: qrSize
    })
    
    page.drawText('Scan to Verify', {
      x: 40,
      y: footerY - 10,
      size: 6.5,
      font: italicFont,
      color: rgb(0.4, 0.4, 0.4)
    })
    page.drawText('Payout Authenticity', {
      x: 40,
      y: footerY - 18,
      size: 6.5,
      font: italicFont,
      color: rgb(0.4, 0.4, 0.4)
    })
  }

  // Right: Finance Officer Signature
  let financeSigImg = null
  if (data.financeOfficerSignature) {
    try {
      const transparentBuffer = await makeTransparent(data.financeOfficerSignature)
      financeSigImg = await pdfDoc.embedPng(transparentBuffer)
    } catch (e) {
      console.error('Failed to process finance signature for payslip:', e)
    }
  }

  const sigX = width - 160
  if (financeSigImg) {
    page.drawImage(financeSigImg, {
      x: sigX,
      y: footerY,
      width: 100,
      height: 100 / 2.67
    })
  }

  page.drawLine({
    start: { x: sigX - 10, y: footerY },
    end: { x: sigX + 110, y: footerY },
    color: rgb(0.6, 0.6, 0.6),
    thickness: 1
  })

  page.drawText('Finance Officer', {
    x: sigX + 15,
    y: footerY - 14,
    size: 9,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2)
  })

  page.drawText(`(${data.financeOfficerName})`, {
    x: sigX + 15,
    y: footerY - 26,
    size: 8,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4)
  })

  // Footnote Disclaimer
  const disclaimerText = 'This is a computer-generated stipend advice slip and does not require a physical stamp.'
  const disclaimerText2 = 'All disbursements are processed digitally after verification by the Finance Department.'
  
  drawCenteredText(disclaimerText, 50, 8, italicFont, rgb(0.5, 0.5, 0.5))
  drawCenteredText(disclaimerText2, 38, 8, italicFont, rgb(0.5, 0.5, 0.5))

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
