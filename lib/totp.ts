import { createHmac } from 'crypto'
import QRCode from 'qrcode'

// Base32 decoder for RFC 6238 TOTP secrets
function base32Decode(base32: string): Buffer {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase())
    if (val < 0) continue
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

// Generate stable Base32 secret for user
export function getUserTOTPSecret(userId: string): string {
  const masterSecret = process.env.CERT_HMAC_SECRET || 'MCL_ENTERPRISE_TOTP_KEY_2026'
  const hmac = createHmac('sha256', masterSecret).update(`totp:${userId}`).digest('hex')
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let secret = ''
  for (let i = 0; i < 32; i++) {
    const charCode = parseInt(hmac.substring(i, i + 1), 16)
    secret += base32Chars[charCode % 32]
  }
  return secret
}

// Verify 6-digit Google Authenticator code (RFC 6238) with ±30s clock drift window
export function verifyGoogleAuthToken(token: string, secret: string): boolean {
  if (!token || token.trim().length !== 6) return false
  const timeStep = 30
  const epoch = Math.floor(Date.now() / 1000)
  const currentCounter = Math.floor(epoch / timeStep)

  for (let windowOffset = -1; windowOffset <= 1; windowOffset++) {
    try {
      const key = base32Decode(secret)
      const time = Buffer.alloc(8)
      time.writeBigInt64BE(BigInt(currentCounter + windowOffset))

      const hmac = createHmac('sha1', key).update(time).digest()
      const offset = hmac[hmac.length - 1] & 0xf
      const code = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff)
      const generatedToken = (code % 1000000).toString().padStart(6, '0')

      if (generatedToken === token.trim()) {
        return true
      }
    } catch {
      continue
    }
  }
  return false
}

// Generate Google Authenticator QR Code Data URL
export async function generateGoogleAuthQRCode(email: string, secret: string): Promise<string> {
  const label = encodeURIComponent(email)
  const issuer = encodeURIComponent('MCL Internship Portal')
  const otpauth = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
  return await QRCode.toDataURL(otpauth)
}
