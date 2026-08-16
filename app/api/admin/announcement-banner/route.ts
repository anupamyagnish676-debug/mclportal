import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isGDriveConfigured, uploadFileToGDrive, getOrCreateNoticesAreaFolder } from '@/lib/gdrive'

let memoryBannerConfig: {
  message: string
  type: 'warning' | 'info' | 'critical'
  isActive: boolean
  updatedAt: string
} = {
  message: 'Welcome to the MCL Decentralized Internship Portal! Ensure your documents and logbooks are up to date.',
  type: 'info',
  isActive: true,
  updatedAt: new Date().toISOString(),
}

export async function GET() {
  return NextResponse.json({ banner: memoryBannerConfig })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, area')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Only administrators can update site announcement banners' }, { status: 403 })
    }

    const { message, type, isActive } = await req.json()

    memoryBannerConfig = {
      message: message || '',
      type: type || 'info',
      isActive: Boolean(isActive),
      updatedAt: new Date().toISOString(),
    }

    // Save copy to Google Drive -> Headquarters -> Notices folder
    if (isGDriveConfigured()) {
      try {
        const noticesFolderId = await getOrCreateNoticesAreaFolder('Headquarters')
        const bannerBuffer = Buffer.from(JSON.stringify(memoryBannerConfig, null, 2), 'utf-8')
        await uploadFileToGDrive({
          buffer: bannerBuffer,
          fileName: 'Site_Announcement_Banner.json',
          mimeType: 'application/json',
          folderId: noticesFolderId,
        })
        console.log('[ANNOUNCEMENT-GDRIVE] Saved announcement banner to HQ Google Drive.')
      } catch (gErr: any) {
        console.warn('[ANNOUNCEMENT-GDRIVE] GDrive save notice:', gErr.message)
      }
    }

    return NextResponse.json({ success: true, banner: memoryBannerConfig })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
