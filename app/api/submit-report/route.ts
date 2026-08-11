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

    const contentType = req.headers.get('content-type') || ''
    const adminClient = createAdminClient()

    let internshipId = ''
    let projectTitle = ''
    let fileUrl = ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      internshipId = (formData.get('internshipId') as string) || ''
      projectTitle = (formData.get('projectTitle') as string) || ''
      const file = formData.get('file') as File | null

      if (!internshipId || !projectTitle || !file) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      const { data: internship, error: fetchErr } = await adminClient
        .from('internships')
        .select('*, student:profiles!internships_student_id_fkey(full_name, area)')
        .eq('id', internshipId)
        .maybeSingle()

      if (fetchErr || !internship) {
        return NextResponse.json({ error: 'Internship not found' }, { status: 404 })
      }

      if (internship.student_id !== user.id) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (!profile || profile.role !== 'admin') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      const ext = path.extname(file.name) || '.pdf'
      const timestamp = Date.now()
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      if (isGDriveConfigured()) {
        const studentFolderId = await getOrCreateStudentFolder({
          studentName: internship.student?.full_name || 'Student',
          studentId: user.id,
          serialNo: internship.serial_no,
          area: internship.area || internship.student?.area || 'Headquarters',
        })
        const gdriveRes = await uploadFileToGDrive({
          buffer,
          fileName: `Project_Report_${timestamp}${ext}`,
          mimeType: file.type || 'application/pdf',
          folderId: studentFolderId,
        })
        fileUrl = gdriveRes.directViewUrl || gdriveRes.webViewLink
      } else {
        const filePath = `project-reports/${internshipId}/${timestamp}_${file.name}`
        const { error: uploadErr } = await adminClient.storage
          .from('assignments')
          .upload(filePath, buffer, { contentType: file.type || 'application/pdf' })

        if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

        const { data: signedData } = await adminClient.storage
          .from('assignments')
          .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10)

        fileUrl = signedData?.signedUrl || ''
      }
    } else {
      const body = await req.json()
      internshipId = body.internshipId
      projectTitle = body.projectTitle
      fileUrl = body.fileUrl
    }

    const today = new Date().toISOString().split('T')[0]

    const { error: updateErr } = await adminClient
      .from('internships')
      .update({
        project_report_url: fileUrl,
        project_title: projectTitle,
        project_submitted_at: today
      })
      .eq('id', internshipId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({ success: true, fileUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
