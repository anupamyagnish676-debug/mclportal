import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!profile || (profile.role !== 'mentor' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { internshipId, approved } = await req.json()
    if (!internshipId) {
      return NextResponse.json({ error: 'Missing internshipId' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Fetch the internship to verify ownership
    const { data: internship, error: fetchErr } = await adminClient
      .from('internships')
      .select('mentor_id')
      .eq('id', internshipId)
      .maybeSingle()

    if (fetchErr || !internship) {
      return NextResponse.json({ error: 'Internship not found' }, { status: 404 })
    }

    // Only allow assigned mentor or admin to approve
    if (profile.role === 'mentor' && internship.mentor_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden - You are not the assigned mentor' }, { status: 403 })
    }

    // Update certificate_approved status
    const { error: updateErr } = await adminClient
      .from('internships')
      .update({ certificate_approved: !!approved })
      .eq('id', internshipId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
