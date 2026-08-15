import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isGDriveConfigured, uploadFileToGDrive, getOrCreateSignaturesAreaFolder } from '@/lib/gdrive'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { signatureData } = await req.json()
    if (!signatureData || !signatureData.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid signature data' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Fetch user profile
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, role, area')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const areaName = profile.area || 'Headquarters'
    const cleanName = (profile.full_name || 'User').replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `${cleanName}_${profile.role}_Signature.png`

    const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '').trim()
    const buffer = Buffer.from(base64Data, 'base64')

    let gdriveFileId: string | null = null

    // 1. Upload signature PNG to Area Google Drive -> Signatures folder
    if (isGDriveConfigured()) {
      try {
        const signaturesFolderId = await getOrCreateSignaturesAreaFolder(areaName)
        const gdriveRes = await uploadFileToGDrive({
          buffer,
          fileName,
          mimeType: 'image/png',
          folderId: signaturesFolderId,
        })
        gdriveFileId = gdriveRes.fileId
        console.log(`[SIGNATURE-GDRIVE] Saved signature to Area Drive: ${fileName} (${gdriveRes.fileId})`)
      } catch (gdriveErr: any) {
        console.warn('[SIGNATURE-GDRIVE] GDrive save notice:', gdriveErr.message)
      }
    }

    // 2. Update profiles table in Supabase
    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({ signature_data: signatureData })
      .eq('id', user.id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

    return NextResponse.json({ success: true, gdriveFileId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
