import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/admin/signature-proxy?area=Lingaraj
 * 
 * Serves the Area Admin's digital signature as a standard PNG image stream.
 * If the area admin has saved a signature in DB, returns that PNG.
 * Otherwise, falls back to serving the default /gm-signature.png image.
 */
export async function GET(req: NextRequest) {
  try {
    const areaName = req.nextUrl.searchParams.get('area') || 'Headquarters'
    const adminClient = createAdminClient()

    let signatureData: string | null = null

    // 1. Try to fetch area admin signature from DB
    if (areaName && areaName !== 'Concerned') {
      const { data: withSigRows } = await adminClient
        .from('profiles')
        .select('signature_data')
        .eq('role', 'admin')
        .ilike('area', areaName.trim())
        .not('signature_data', 'is', null)
        .limit(1)

      if (withSigRows && withSigRows.length > 0 && withSigRows[0].signature_data) {
        signatureData = withSigRows[0].signature_data
      }
    }

    // If no specific area admin signature, try Headquarters admin signature
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

    // 2. If valid base64 signature found, parse and return PNG buffer
    if (signatureData && signatureData.startsWith('data:image/')) {
      const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '').trim().replace(/\s+/g, '')
      const buffer = Buffer.from(base64Data, 'base64')

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store, max-age=0',
        },
      })
    }

    // 3. Fallback: serve local gm-signature.png file
    const fallbackPath = path.join(process.cwd(), 'public', 'gm-signature.png')
    if (fs.existsSync(fallbackPath)) {
      const fallbackBuffer = fs.readFileSync(fallbackPath)
      return new NextResponse(fallbackBuffer, {
        headers: {
          'Content-Type': 'image/png',
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
