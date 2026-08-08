import crypto from 'crypto'

const OTP_SECRET = process.env.CERT_HMAC_SECRET || 'mcl-otp-secure-secret-key-2026'

/**
 * Generate a 6-digit cryptographically secure OTP string (100000 - 999999)
 */
export function generate6DigitOTP(): string {
  return crypto.randomInt(100000, 1000000).toString()
}

/**
 * Generate HMAC hash for OTP verification
 */
export function generateOTPHash(email: string, otp: string, expiresAt: number): string {
  const normalizedEmail = email.toLowerCase().trim()
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`${normalizedEmail}:${otp}:${expiresAt}`)
    .digest('hex')
}

/**
 * Verify if provided OTP matches the HMAC hash and has not expired
 */
export function verifyOTPHash(
  email: string,
  otp: string,
  expiresAt: number,
  providedHash: string
): { valid: boolean; reason?: string } {
  if (Date.now() > expiresAt) {
    return { valid: false, reason: 'OTP code has expired. Please request a new code.' }
  }

  const expectedHash = generateOTPHash(email, otp, expiresAt)
  if (expectedHash !== providedHash) {
    return { valid: false, reason: 'Invalid OTP code. Please check your email and try again.' }
  }

  return { valid: true }
}

/**
 * Send Email OTP via Nodemailer (Gmail SMTP)
 */
export async function sendOTPEmail(params: {
  email: string
  fullName?: string
  otpCode: string
  role: string
}): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.error('[OTP] Gmail SMTP not configured (GMAIL_USER/GMAIL_PASS missing)')
    return false
  }

  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    })

    const roleLabel = params.role.charAt(0).toUpperCase() + params.role.slice(1)
    const recipientName = params.fullName || params.email

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: #166534; padding: 28px 32px; color: #ffffff;">
          <h1 style="margin: 0; font-size: 20px; font-weight: bold;">Mahanadi Coalfields Limited</h1>
          <p style="margin: 4px 0 0; font-size: 12px; color: #bbf7d0;">A Subsidiary of Coal India Limited</p>
        </div>
        
        <div style="padding: 32px; color: #374151; background: #ffffff;">
          <h2 style="color: #166534; margin-top: 0; font-size: 18px; font-weight: bold;">Login Verification Code</h2>
          <p style="font-size: 14px; color: #4b5563;">Dear <strong>${recipientName}</strong> (${roleLabel}),</p>
          <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
            Use the following 6-digit OTP code to complete your sign-in to the <strong>MCL Internship Portal</strong>:
          </p>

          <div style="background: #f0fdf4; border: 2px border-style: dashed; border-color: #166534; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 6px 0; font-size: 11px; color: #166534; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">YOUR VERIFICATION CODE</p>
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #166534; font-family: monospace;">
              ${params.otpCode}
            </div>
          </div>

          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-bottom: 20px;">
            ⏰ <strong>Important:</strong> This OTP is valid for <strong>5 minutes</strong> only. Do not share this code with anyone.
          </div>

          <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0;">
            If you did not request this login code, please contact your system administrator immediately.
          </p>
        </div>

        <div style="background: #f9fafb; padding: 14px 32px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af;">
          MCL Internship Portal &nbsp;|&nbsp; Official Security Communication
        </div>
      </div>
    `

    await transporter.sendMail({
      from: `"MCL Portal Security" <${process.env.GMAIL_USER}>`,
      to: params.email,
      subject: `🔑 ${params.otpCode} is your MCL Portal Login OTP`,
      html: htmlContent,
    })

    console.log(`[OTP] Sent OTP ${params.otpCode} to ${params.email}`)
    return true
  } catch (err: any) {
    console.error(`[OTP] Failed to send email to ${params.email}:`, err.message)
    return false
  }
}
