import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify requesting user is an admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — Admins only' }, { status: 403 })
    }

    const { applicationId } = await req.json()
    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 1. Fetch the LOR application details
    const { data: app, error: fetchError } = await adminClient
      .from('applications')
      .select('*, referrer:profiles!applications_referred_by_fkey(area)')
      .eq('id', applicationId)
      .maybeSingle()

    if (fetchError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (app.status === 'approved') {
      return NextResponse.json({ error: 'Application is already approved' }, { status: 400 })
    }

    const email = app.student_email
    const full_name = app.student_name

    if (!email || !full_name) {
      return NextResponse.json({ error: 'Application is missing student details (name/email)' }, { status: 400 })
    }

    // 2. Update LOR application status to 'approved'
    const { error: updateError } = await adminClient
      .from('applications')
      .update({ 
        status: 'approved'
      })
      .eq('id', applicationId)

    if (updateError) {
      return NextResponse.json({ error: `Failed to update application: ${updateError.message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
