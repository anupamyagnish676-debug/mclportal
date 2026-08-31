import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Proxies document images through our own server so the browser
 * can use them in canvas operations (face-api.js) without CORS issues.
 * 
 * Usage: GET /api/image-proxy?url=<encoded_url>
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check — only logged-in users can proxy images
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = req.nextUrl.searchParams.get('url')
    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    // Fetch the image server-side (no CORS restrictions on server)
    const response = await fetch(url)
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = Buffer.from(await response.arrayBuffer())

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
