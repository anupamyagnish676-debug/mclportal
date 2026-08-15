import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import fs from 'fs'
import path from 'path'

export const revalidate = 0

/**
 * GET /api/admin/signature-proxy?area=Lingaraj
 * 
 * Serves the Area Admin's digital signature as a standard PNG image stream.
 * If the area admin has saved a signature in DB, returns that PNG.
 * Otherwise, falls back to serving the default /gm-signature.png image.
 */
export async function GET(req: NextRequest) {
  try {
    const rawArea = req.nextUrl.searchParams.get('area') || 'Headquarters'
    // Clean area name in case it contains "Area Office" or whitespace
    const areaName = rawArea.replace(/Area Office/gi, '').trim()

    const adminClient = createAdminClient()

    let signatureData: string | null = null

    // 1. Try to fetch area admin signature from DB for specified area
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

    // 2. If no area match, fallback to ANY admin who has a signature saved
    if (!signatureData) {
      const { data: anyAdminRows } = await adminClient
        .from('profiles')
        .select('signature_data')
        .eq('role', 'admin')
        .not('signature_data', 'is', null)
        .limit(1)

      if (anyAdminRows && anyAdminRows.length > 0 && anyAdminRows[0].signature_data) {
        signatureData = anyAdminRows[0].signature_data
      }
    }

    // 3. If valid base64 signature found, convert to Uint8Array and return PNG
    if (signatureData) {
      let base64Data = signatureData
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1]
      }
      base64Data = base64Data.trim().replace(/\s+/g, '')

      const buffer = Buffer.from(base64Data, 'base64')
      const uint8 = new Uint8Array(buffer)

      return new NextResponse(uint8, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(uint8.byteLength),
          'Cache-Control': 'no-store, max-age=0',
        },
      })
    }

    // 4. Ultimate Fallback: serve local public/gm-signature.png file
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
