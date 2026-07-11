import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import path from 'path'

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
      return NextResponse.json({ error: 'Forbidden — students only' }, { status: 403 })
    }

    const { data: internship } = await supabase
      .from('internships')
      .select('id, internship_type, bank_document_path')
      .eq('student_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!internship) {
      return NextResponse.json({ error: 'Active internship not found' }, { status: 404 })
    }

    if (internship.internship_type !== 'paid') {
      return NextResponse.json({ error: 'This internship is not configured as Paid' }, { status: 400 })
    }

    const formData = await req.formData()
    const bank_name = formData.get('bank_name') as string | null
    const bank_account_no = formData.get('bank_account_no') as string | null
    const bank_ifsc_code = formData.get('bank_ifsc_code') as string | null
    const file = formData.get('file') as File | null

    if (!bank_name || !bank_account_no || !bank_ifsc_code || !file) {
      return NextResponse.json({ error: 'All fields (bank_name, bank_account_no, bank_ifsc_code, file) are required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const ext = path.extname(file.name) || '.bin'
    const timestamp = Date.now()
    const storagePath = `${user.id}/bank_cheque_${timestamp}${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload new cheque file to Supabase Storage 'documents'
    const { error: uploadError } = await adminClient.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Cheque file upload failed: ${uploadError.message}` }, { status: 500 })
    }

    // Get signed URL for the document (1 year expiry)
    const { data: signedUrlData } = await adminClient.storage
      .from('documents')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

    const fileUrl = signedUrlData?.signedUrl || ''

    // If student had a previous document, clean it up
    if (internship.bank_document_path) {
      try {
        await adminClient.storage.from('documents').remove([internship.bank_document_path])
      } catch (err: any) {
        console.error('Failed to remove old bank cheque file:', err.message)
      }
    }

    // Update the internship details
    const { error: updateError } = await adminClient
      .from('internships')
      .update({
        bank_name,
        bank_account_no,
        bank_ifsc_code,
        bank_document_path: storagePath,
        bank_document_url: fileUrl,
        bank_details_status: 'submitted',
        bank_rejection_reason: null
      })
      .eq('id', internship.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
