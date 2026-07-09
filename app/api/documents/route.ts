import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import path from 'path'

const DOC_TYPES = ['affidavit', 'college_id', 'bonafide', 'aadhaar', 'photo'] as const
type DocType = typeof DOC_TYPES[number]

const DOC_LABELS: Record<DocType, string> = {
  affidavit: 'Affidavit (Signed)',
  college_id: 'College ID Card',
  bonafide: 'Bonafide Certificate',
  aadhaar: 'Aadhaar Card',
  photo: 'Passport Photo',
}

// POST: Student uploads a document
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'student') {
      return NextResponse.json({ error: 'Only students can upload documents' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const doc_type = formData.get('doc_type') as string | null

    if (!file || !doc_type) {
      return NextResponse.json({ error: 'file and doc_type are required' }, { status: 400 })
    }

    if (!DOC_TYPES.includes(doc_type as DocType)) {
      return NextResponse.json({ error: `Invalid doc_type. Must be one of: ${DOC_TYPES.join(', ')}` }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const ext = path.extname(file.name) || '.bin'
    const timestamp = Date.now()
    const storagePath = `${user.id}/${doc_type}_${timestamp}${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage bucket 'documents'
    const { error: uploadError } = await adminClient.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
    }

    // Get the public URL
    const { data: urlData } = adminClient.storage
      .from('documents')
      .getPublicUrl(storagePath)

    const fileUrl = urlData?.publicUrl || ''

    // Check if a record already exists for same student + doc_type
    const { data: existing } = await adminClient
      .from('student_documents')
      .select('id, file_path')
      .eq('student_id', user.id)
      .eq('doc_type', doc_type)
      .maybeSingle()

    if (existing) {
      // Delete old file from storage
      if (existing.file_path) {
        await adminClient.storage.from('documents').remove([existing.file_path])
      }

      // Update the existing record
      const { data, error } = await adminClient
        .from('student_documents')
        .update({
          file_url: fileUrl,
          file_path: storagePath,
          status: 'pending',
          rejection_reason: null,
          uploaded_at: new Date().toISOString(),
          verified_at: null,
          verified_by: null,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, document: data, action: 'updated' })
    } else {
      // Insert a new record
      const { data, error } = await adminClient
        .from('student_documents')
        .insert({
          student_id: user.id,
          doc_type,
          file_url: fileUrl,
          file_path: storagePath,
          status: 'pending',
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, document: data, action: 'created' })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET: Fetch documents (role-scoped)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, area')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const adminClient = createAdminClient()

    if (profile.role === 'student') {
      const { data, error } = await adminClient
        .from('student_documents')
        .select('*')
        .eq('student_id', user.id)
        .order('uploaded_at', { ascending: false })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ documents: data })

    } else if (profile.role === 'admin') {
      const isHQ = profile.area === 'Headquarters'

      let studentQuery = adminClient
        .from('profiles')
        .select('id, full_name, email, area')
        .eq('role', 'student')

      if (!isHQ && profile.area) {
        studentQuery = studentQuery.eq('area', profile.area)
      }

      const { data: students, error: stuErr } = await studentQuery
      if (stuErr) return NextResponse.json({ error: stuErr.message }, { status: 500 })

      const studentIds = (students || []).map((s: any) => s.id)
      if (studentIds.length === 0) return NextResponse.json({ documents: [], students: [] })

      const { data: documents, error: docErr } = await adminClient
        .from('student_documents')
        .select('*, student:profiles!student_documents_student_id_fkey(id, full_name, email, area)')
        .in('student_id', studentIds)
        .order('uploaded_at', { ascending: false })

      if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 })
      return NextResponse.json({ documents, students })
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH: Admin approves or rejects a document
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    const body = await req.json()
    const { doc_id, status, rejection_reason } = body

    if (!doc_id || !status) {
      return NextResponse.json({ error: 'doc_id and status are required' }, { status: 400 })
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Status must be approved or rejected' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Fetch the document to get student info for email
    const { data: docRecord, error: fetchErr } = await adminClient
      .from('student_documents')
      .select('*, student:profiles!student_documents_student_id_fkey(full_name, email)')
      .eq('id', doc_id)
      .maybeSingle()

    if (fetchErr || !docRecord) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const updatePayload: Record<string, any> = {
      status,
      verified_at: new Date().toISOString(),
      verified_by: user.id,
    }

    if (status === 'rejected') {
      updatePayload.rejection_reason = rejection_reason || 'No reason provided'
    } else {
      updatePayload.rejection_reason = null
    }

    const { data, error } = await adminClient
      .from('student_documents')
      .update(updatePayload)
      .eq('id', doc_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Send rejection email via nodemailer
    if (status === 'rejected') {
      try {
        const gmailUser = process.env.GMAIL_USER
        const gmailPass = process.env.GMAIL_PASS
        const studentEmail = docRecord.student?.email
        const studentName = docRecord.student?.full_name || 'Student'
        const docLabel = DOC_LABELS[docRecord.doc_type as DocType] || docRecord.doc_type

        if (gmailUser && gmailPass && studentEmail) {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: gmailUser, pass: gmailPass },
          })

          await transporter.sendMail({
            from: `"MCL Internship Portal" <${gmailUser}>`,
            to: studentEmail,
            subject: 'Document Verification Update — MCL Portal',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 24px; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 20px;">MCL Internship Portal</h1>
                  <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">Mahanadi Coalfields Limited</p>
                </div>
                <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                  <p style="color: #374151; font-size: 15px;">Dear <strong>${studentName}</strong>,</p>
                  <p style="color: #374151;">Your document <strong>"${docLabel}"</strong> has been reviewed and requires your attention.</p>
                  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="color: #dc2626; font-weight: 600; margin: 0 0 8px;">❌ Document Rejected</p>
                    <p style="color: #7f1d1d; margin: 0; font-size: 14px;"><strong>Reason:</strong> ${rejection_reason || 'The document did not meet the required standards.'}</p>
                  </div>
                  <p style="color: #374151;">Please log in to the MCL Portal and re-upload a corrected version of this document at your earliest convenience.</p>
                  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">This is an automated message from the MCL Internship Portal. Please do not reply to this email.</p>
                    <p style="color: #6b7280; font-size: 12px; margin: 4px 0 0;">Mahanadi Coalfields Limited — Training &amp; Development Division</p>
                  </div>
                </div>
              </div>
            `,
          })
        }
      } catch (emailErr: any) {
        // Email failure is non-fatal — log it but don't fail the request
        console.error('Rejection email failed:', emailErr.message)
      }
    }

    return NextResponse.json({ success: true, document: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
