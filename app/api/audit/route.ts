import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Only allow admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, area').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isHQ = profile?.area === 'Headquarters'
  const adminArea = profile?.area || ''

  const { searchParams } = new URL(request.url)
  const page   = parseInt(searchParams.get('page') || '1')
  const limit  = 50
  const offset = (page - 1) * limit
  const action = searchParams.get('action') || null

  const admin = createAdminClient()

  // ── Area restriction ───────────────────────────────────────────────────
  // Area admins only see logs from users in their area
  // HQ admins see everything
  let allowedUserIds: string[] | null = null

  if (!isHQ && adminArea) {
    const { data: areaProfiles } = await admin
      .from('profiles')
      .select('id')
      .eq('area', adminArea)

    allowedUserIds = (areaProfiles || []).map((p: any) => p.id)

    // If no users in area, return empty immediately
    if (allowedUserIds.length === 0) {
      return NextResponse.json({ logs: [], total: 0, page, limit, isHQ, adminArea })
    }
  }

  let query = admin
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) query = query.eq('action', action)

  // Filter by user_ids belonging to this area (for area admins)
  if (allowedUserIds !== null) {
    query = query.in('user_id', allowedUserIds)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    logs: data || [],
    total: count || 0,
    page,
    limit,
    isHQ,
    adminArea,
  })
}
