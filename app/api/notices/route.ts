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
      .select('role, area')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { title, content, target_roles, target_areas, priority, forwarded_from } = await req.json()
    if (!title || !content) {
      return NextResponse.json({ error: 'Missing title or content' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const isHq = profile.area === 'Headquarters'

    let finalRoles = target_roles || []
    let finalAreas = target_areas || ['all']

    if (isHq) {
      // HQ Admin: target_roles always includes 'admin' if sent to other admins, or can just be sent to all
      if (!finalRoles.includes('admin')) {
        finalRoles.push('admin')
      }
    } else {
      // Area Admin: can only target their own area, and cannot target 'admin'
      finalAreas = [profile.area]
      finalRoles = finalRoles.filter((r: string) => r !== 'admin')
    }

    const { data, error } = await adminClient
      .from('notices')
      .insert({
        title,
        content,
        created_by: user.id,
        source_area: profile.area,
        is_hq_notice: isHq,
        target_roles: finalRoles,
        target_areas: finalAreas,
        priority: priority || 'normal',
        forwarded_from: forwarded_from || null
      })
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, data })
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

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const adminClient = createAdminClient()

    // Base query: fetch all notices
    let query = adminClient
      .from('notices')
      .select(`
        *,
        created_by_profile:profiles!notices_created_by_fkey(full_name, role),
        notice_reads(user_id)
      `)
      .order('created_at', { ascending: false })

    const { data: allNotices, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    let filteredNotices = allNotices || []

    if (profile.role === 'admin') {
      const isHq = profile.area === 'Headquarters'
      if (!isHq) {
        // Area admin: sees notices targeted to admins (HQ notices) OR created by them
        filteredNotices = allNotices?.filter((n: any) => {
          const isCreator = n.created_by === user.id
          const isTargeted = n.target_roles.includes('admin') && (n.target_areas.includes('all') || n.target_areas.includes(profile.area))
          return isCreator || isTargeted
        }) || []
      }
    } else {
      // Mentor, Student, Employee: see notices matching their role and area
      filteredNotices = allNotices?.filter((n: any) => {
        const roleMatches = n.target_roles.includes(profile.role)
        const areaMatches = n.target_areas.includes('all') || n.target_areas.includes(profile.area)
        return roleMatches && areaMatches
      }) || []
    }

    return NextResponse.json({ data: filteredNotices })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { notice_id } = await req.json()
    if (!notice_id) return NextResponse.json({ error: 'Missing notice_id' }, { status: 400 })

    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('notice_reads')
      .upsert({
        notice_id,
        user_id: user.id,
        read_at: new Date().toISOString()
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
