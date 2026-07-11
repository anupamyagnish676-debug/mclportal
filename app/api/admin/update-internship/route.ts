import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if the user is an admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, area')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — Admins only' }, { status: 403 })
    }

    const { internshipId, internship_type } = await req.json()
    if (!internshipId || !internship_type) {
      return NextResponse.json({ error: 'Missing internshipId or internship_type' }, { status: 400 })
    }

    if (internship_type !== 'paid' && internship_type !== 'unpaid') {
      return NextResponse.json({ error: 'Invalid internship category' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Retrieve target internship to check area match for area admins
    const { data: internship } = await adminClient
      .from('internships')
      .select('area')
      .eq('id', internshipId)
      .maybeSingle()

    if (!internship) {
      return NextResponse.json({ error: 'Internship not found' }, { status: 404 })
    }

    // Check area mismatch for non-HQ admins
    if (profile.area && profile.area !== 'Headquarters' && internship.area !== profile.area) {
      return NextResponse.json({ error: 'Forbidden — Area mismatch' }, { status: 403 })
    }

    // Perform update
    const { error } = await adminClient
      .from('internships')
      .update({
        internship_type
      })
      .eq('id', internshipId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
