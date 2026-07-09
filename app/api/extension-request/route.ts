import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

    if (!profile || profile.role !== 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { requested_end_date, reason } = await req.json()
    if (!requested_end_date || !reason) {
      return NextResponse.json({ error: 'Missing requested_end_date or reason' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Get active internship
    const { data: internship } = await adminClient
      .from('internships')
      .select('id')
      .eq('student_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!internship) return NextResponse.json({ error: 'No active internship found' }, { status: 404 })

    const { error } = await adminClient
      .from('extension_requests')
      .insert({
        internship_id: internship.id,
        student_id: user.id,
        requested_end_date,
        reason,
        mentor_status: 'pending',
        admin_status: 'pending'
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
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

    const { request_id, mentor_status, mentor_remarks, admin_status, admin_remarks } = await req.json()
    if (!request_id) return NextResponse.json({ error: 'Missing request_id' }, { status: 400 })

    const adminClient = createAdminClient()

    if (profile.role === 'mentor' && mentor_status) {
      const { error } = await adminClient
        .from('extension_requests')
        .update({
          mentor_status,
          mentor_remarks
        })
        .eq('id', request_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    } else if (profile.role === 'admin' && admin_status) {
      const { error: updateError } = await adminClient
        .from('extension_requests')
        .update({
          admin_status,
          admin_remarks
        })
        .eq('id', request_id)

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

      if (admin_status === 'approved') {
        // Fetch extension request details to get the requested date and internship_id
        const { data: request } = await adminClient
          .from('extension_requests')
          .select('internship_id, requested_end_date')
          .eq('id', request_id)
          .maybeSingle()

        if (request) {
          const { error: updateDateError } = await adminClient
            .from('internships')
            .update({ end_date: request.requested_end_date })
            .eq('id', request.internship_id)

          if (updateDateError) return NextResponse.json({ error: updateDateError.message }, { status: 400 })
        }
      }

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
