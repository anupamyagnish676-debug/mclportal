import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isGDriveConfigured, uploadFileToGDrive, getOrCreateStudyMaterialsAreaFolder } from '@/lib/gdrive'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const title = formData.get('title') as string
    const internshipId = formData.get('internshipId') as string
    const file = formData.get('file') as File | null

    if (!title || !internshipId || !file) {
      return NextResponse.json({ error: 'Missing title, internshipId, or file' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Get mentor profile and student's internship details
    const { data: internship } = await adminClient
      .from('internships')
      .select('id, student:profiles!internships_student_id_fkey(full_name, area)')
      .eq('id', internshipId)
      .maybeSingle()

    if (!internship) return NextResponse.json({ error: 'Internship not found' }, { status: 404 })

    const areaName = (internship as any).student?.area || 'Headquarters'
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const buffer = Buffer.from(await file.arrayBuffer())

    let finalFileUrl = ''
    let finalFilePath = ''

    // 1. Try Google Drive Upload in Area -> Study_Materials folder
    if (isGDriveConfigured()) {
      try {
        const studyMaterialsFolderId = await getOrCreateStudyMaterialsAreaFolder(areaName)
        const gdriveRes = await uploadFileToGDrive({
          buffer: buffer,
          fileName,
          mimeType: file.type || 'application/pdf',
          folderId: studyMaterialsFolderId,
        })
        finalFileUrl = gdriveRes.webViewLink
        finalFilePath = `gdrive:${gdriveRes.fileId}`
      } catch (gdriveErr: any) {
        console.warn('[MATERIALS] GDrive upload failed, using Supabase fallback:', gdriveErr.message)
      }
    }

    // 2. Supabase Storage Fallback
    if (!finalFileUrl) {
      const storagePath = `study-materials/${areaName}/${fileName}`
      const { error: uploadErr } = await adminClient.storage
        .from('documents')
        .upload(storagePath, buffer, { contentType: file.type || 'application/pdf', upsert: true })

      if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 400 })

      const { data: signedData } = await adminClient.storage
        .from('documents')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

      finalFileUrl = signedData?.signedUrl || ''
      finalFilePath = storagePath
    }

    // 3. Insert record in materials database table
    const { data, error: insertError } = await adminClient
      .from('materials')
      .insert({
        internship_id: internshipId,
        title,
        file_url: finalFileUrl,
        uploaded_by: user.id,
      })
      .select()
      .maybeSingle()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
