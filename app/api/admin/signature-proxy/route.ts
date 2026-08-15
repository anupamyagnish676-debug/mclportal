import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import fs from 'fs'
import path from 'path'
import { Jimp } from 'jimp'

export const revalidate = 0

// Helper matching certificate signature transparency processing
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

/**
 * GET /api/admin/signature-proxy?area=Lingaraj
 * 
 * Serves the Area Admin's digital signature as a standard transparent PNG image stream.
 * Uses exact Jimp transparent PNG processing matching the Certificate signature generator.
 */
export async function GET(req: NextRequest) {
  try {
    const rawArea = req.nextUrl.searchParams.get('area') || 'Headquarters'
    const areaName = rawArea.replace(/Area Office/gi, '').trim()

    const adminClient = createAdminClient()
    let signatureData: string | null = null

    // 1. Fetch Area Admin signature for the student's area
    if (areaName && areaName !== 'Concerned') {
      const { data: withSigRows } = await adminClient
        .from('profiles')
        .select('signature_data')
        .eq('role', 'admin')
        .ilike('area', `%${areaName}%`)
        .not('signature_data', 'is', null)
        .limit(1)

      if (withSigRows && withSigRows.length > 0 && withSigRows[0].signature_data) {
        signatureData = withSigRows[0].signature_data
      }
    }

    // 2. Fallback: Headquarters Admin signature
    if (!signatureData) {
      const { data: hqRows } = await adminClient
        .from('profiles')
        .select('signature_data')
        .eq('role', 'admin')
        .ilike('area', 'Headquarters')
        .not('signature_data', 'is', null)
        .limit(1)

      if (hqRows && hqRows.length > 0 && hqRows[0].signature_data) {
        signatureData = hqRows[0].signature_data
      }
    }

    // 3. Fallback: ANY admin signature
    if (!signatureData) {
      const { data: anyRows } = await adminClient
        .from('profiles')
        .select('signature_data')
        .eq('role', 'admin')
        .not('signature_data', 'is', null)
        .limit(1)

      if (anyRows && anyRows.length > 0 && anyRows[0].signature_data) {
        signatureData = anyRows[0].signature_data
      }
    }

    // 4. Process signature with Jimp transparency (same as certificate logic)
    if (signatureData) {
      try {
        const transparentPngBuffer = await makeTransparent(signatureData)
        const uint8 = new Uint8Array(transparentPngBuffer)

        return new NextResponse(uint8, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Content-Length': String(uint8.byteLength),
            'Cache-Control': 'no-store, max-age=0',
          },
        })
      } catch (jimpErr: any) {
        console.warn('[signature-proxy] Jimp transparency warning, falling back to raw buffer:', jimpErr.message)
        const rawBase64 = signatureData.includes(',') ? signatureData.split(',')[1] : signatureData
        const rawBuffer = Buffer.from(rawBase64.trim(), 'base64')
        const uint8 = new Uint8Array(rawBuffer)

        return new NextResponse(uint8, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Content-Length': String(uint8.byteLength),
            'Cache-Control': 'no-store, max-age=0',
          },
        })
      }
    }

    // 5. Ultimate Fallback: serve local public/gm-signature.png file
    const fallbackPath = path.join(process.cwd(), 'public', 'gm-signature.png')
    if (fs.existsSync(fallbackPath)) {
      const fallbackBuffer = fs.readFileSync(fallbackPath)
      const uint8 = new Uint8Array(fallbackBuffer)
      return new NextResponse(uint8, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(uint8.byteLength),
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    return new NextResponse('Signature not found', { status: 404 })
  } catch (err: any) {
    console.error('[signature-proxy] Error:', err.message)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
