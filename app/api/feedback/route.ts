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

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const body = await req.json()
    const { internship_id } = body
    if (!internship_id) return NextResponse.json({ error: 'Missing internship_id' }, { status: 400 })

    const adminClient = createAdminClient()

    if (profile.role === 'student') {
      const { rating, comments } = body
      if (rating === undefined) return NextResponse.json({ error: 'Missing rating' }, { status: 400 })

      const { error } = await adminClient
        .from('internship_feedback')
        .upsert({
          internship_id,
          student_rating: rating,
          student_comments: comments,
          submitted_by_student_at: new Date().toISOString()
        }, { onConflict: 'internship_id' })

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    } else if (profile.role === 'mentor') {
      const { rating, comments } = body
      if (rating === undefined) return NextResponse.json({ error: 'Missing rating' }, { status: 400 })

      const { error } = await adminClient
        .from('internship_feedback')
        .upsert({
          internship_id,
          mentor_rating: rating,
          mentor_comments: comments,
          submitted_by_mentor_at: new Date().toISOString()
        }, { onConflict: 'internship_id' })

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminClient = createAdminClient()
    let query = adminClient
      .from('internship_feedback')
      .select(`
        *,
        internship:internships(
          area,
          student:profiles!internships_student_id_fkey(full_name, university, wing)
        )
      `)

    const { data: feedback, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Filter by area if not HQ admin
    const filtered = profile.area === 'Headquarters'
      ? feedback
      : feedback?.filter((f: any) => f.internship?.area === profile.area)

    return NextResponse.json({ data: filtered })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
