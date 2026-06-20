import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { internshipId, fileUrl, projectTitle } = await req.json()
    if (!internshipId || !fileUrl || !projectTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Verify this internship belongs to the current student
    const { data: internship, error: fetchErr } = await adminClient
      .from('internships')
      .select('student_id')
      .eq('id', internshipId)
      .maybeSingle()

    if (fetchErr || !internship) {
      return NextResponse.json({ error: 'Internship not found' }, { status: 404 })
    }

    if (internship.student_id !== user.id) {
      // Check if user is admin
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (!profile || profile.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const today = new Date().toISOString().split('T')[0]

    // Update internships table using admin client (bypassing RLS)
    const { error: updateErr } = await adminClient
      .from('internships')
      .update({
        project_report_url: fileUrl,
        project_title: projectTitle,
        project_submitted_at: today
      })
      .eq('id', internshipId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
