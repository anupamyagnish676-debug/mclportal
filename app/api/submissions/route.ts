import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import path from 'path'
import { isGDriveConfigured, uploadFileToGDrive, getOrCreateStudentFolder } from '@/lib/gdrive'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const assignmentId = formData.get('assignmentId') as string | null
    const file = formData.get('file') as File | null

    if (!assignmentId || !file) {
      return NextResponse.json({ error: 'assignmentId and file are required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: stuProfile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const { data: stuInternship } = await adminClient
      .from('internships')
      .select('serial_no')
      .eq('student_id', user.id)
      .limit(1)
      .maybeSingle()

    const ext = path.extname(file.name) || '.bin'
    const timestamp = Date.now()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let fileUrl = ''

    if (isGDriveConfigured()) {
      const studentFolderId = await getOrCreateStudentFolder({
        studentName: stuProfile?.full_name || 'Student',
        studentId: user.id,
        serialNo: stuInternship?.serial_no,
      })
      const gdriveRes = await uploadFileToGDrive({
        buffer,
        fileName: `Assignment_${timestamp}${ext}`,
        mimeType: file.type || 'application/octet-stream',
        folderId: studentFolderId,
      })
      fileUrl = gdriveRes.directViewUrl || gdriveRes.webViewLink
    } else {
      const filePath = `${user.id}/${assignmentId}/${timestamp}_${file.name}`
      const { error: uploadError } = await adminClient.storage
        .from('assignments')
        .upload(filePath, buffer, { contentType: file.type || 'application/octet-stream' })

      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

      const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
        .from('assignments')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365)

      if (signedUrlError) return NextResponse.json({ error: signedUrlError.message }, { status: 500 })
      fileUrl = signedUrlData.signedUrl
    }

    const { data: sub, error: insertError } = await adminClient
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: user.id,
        file_url: fileUrl,
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ success: true, submission: sub })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
