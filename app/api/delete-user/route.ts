import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    const { studentId, internshipId } = await req.json()

    if (!studentId) {
      return NextResponse.json({ error: 'Missing student ID' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 1. Delete associated data to prevent foreign key constraint violations
    if (internshipId) {
      // Delete submissions (needs joining table check or direct select)
      await adminClient.from('submissions').delete().eq('student_id', studentId)
      // Delete attendance
      await adminClient.from('attendance').delete().eq('internship_id', internshipId)
      // Delete materials (if any are tied to this internship)
      await adminClient.from('materials').delete().eq('internship_id', internshipId)
      // Delete internship
      await adminClient.from('internships').delete().eq('id', internshipId)
    }

    // 2. Delete profile
    await adminClient.from('profiles').delete().eq('id', studentId)

    // 3. Delete from Auth
    const { error: authError } = await adminClient.auth.admin.deleteUser(studentId)

    if (authError) {
      return NextResponse.json({ error: `Auth deletion failed: ${authError.message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
