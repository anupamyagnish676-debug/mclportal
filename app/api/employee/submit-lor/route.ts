import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import path from 'path'
import { isGDriveConfigured, uploadFileToGDrive, getOrCreateLorAreaFolder } from '@/lib/gdrive'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify requesting user is an employee or admin
    const { data: profile } = await supabase.from('profiles').select('role, area').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'employee' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — Employee or Admin only' }, { status: 403 })
    }

    const formData = await req.formData()
    const studentEmail = formData.get('studentEmail') as string | null
    const studentName = formData.get('studentName') as string | null
    const employeeCode = formData.get('employeeCode') as string | null
    const rollNo = formData.get('rollNo') as string | null
    const university = formData.get('university') as string | null
    const file = formData.get('file') as File | null

    if (!studentEmail || !studentName || !employeeCode || !rollNo || !university || !file) {
      return NextResponse.json({ error: 'Missing required fields or file' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = path.extname(file.name) || '.pdf'
    const timestamp = Date.now()

    let lorUrl = ''

    if (isGDriveConfigured()) {
      try {
        // Find or Create "LOR / {AreaName}" Subfolder in Google Drive
        const employeeArea = profile?.area || 'Headquarters'
        const lorAreaFolderId = await getOrCreateLorAreaFolder(employeeArea)

        // Upload file directly into LOR -> Area subfolder
        const sanitizedName = studentName.trim().replace(/[^a-zA-Z0-9]/g, '_')
        const gdriveRes = await uploadFileToGDrive({
          buffer,
          fileName: `LOR_${sanitizedName}_${timestamp}${ext}`,
          mimeType: file.type || 'application/pdf',
          folderId: lorAreaFolderId,
        })
        lorUrl = gdriveRes.directViewUrl || gdriveRes.webViewLink
      } catch (gdriveErr: any) {
        console.warn('[GDRIVE] LOR upload failed (invalid_grant or token expired), falling back to Supabase Storage:', gdriveErr.message || gdriveErr)
        lorUrl = ''
      }
    }

    if (!lorUrl) {
      // Fallback to Supabase Storage
      const sanitizedEmail = studentEmail.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')
      const storagePath = `lors/${sanitizedEmail}/${timestamp}_lor.pdf`

      const { error: uploadError } = await adminClient.storage
        .from('lor-documents')
        .upload(storagePath, buffer, {
          contentType: file.type || 'application/pdf',
          upsert: true,
        })

      if (uploadError) {
        return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
      }

      // Generate a 1-year signed URL
      const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
        .from('lor-documents')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

      if (signedUrlError) {
        return NextResponse.json({ error: `Signed URL generation failed: ${signedUrlError.message}` }, { status: 500 })
      }

      lorUrl = signedUrlData.signedUrl
    }

    // 1. Resolve student ID if a profile already exists for this email
    let { data: student } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', studentEmail.trim().toLowerCase())
      .maybeSingle()

    const studentId = student?.id || null

    // 2. Insert LOR application, storing student info and employee code in applications table
    const { error: insertError } = await adminClient.from('applications').insert({
      student_id: studentId,
      student_name: studentName.trim(),
      student_email: studentEmail.trim().toLowerCase(),
      employee_code: employeeCode.trim(),
      roll_no: rollNo.trim(),
      university: university.trim(),
      referred_by: user.id,
      lor_url: lorUrl,
      status: 'pending',
    })

    if (insertError) {
      return NextResponse.json({ error: `Failed to insert application: ${insertError.message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
