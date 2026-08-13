import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const area = searchParams.get('area')

    const adminClient = createAdminClient()

    // Fetch global departments
    const { data: allDepts } = await adminClient.from('departments').select('*').order('name')
    const departmentsList = allDepts || []

    // Fetch area_departments mappings
    let query = adminClient.from('area_departments').select('*')
    if (area) {
      query = query.eq('area', area)
    }
    const { data: areaDeptsData } = await query

    // Build department availability mapping across all areas
    // Map: { [deptName]: [area1, area2, ...] }
    const deptAvailabilityMap: Record<string, string[]> = {}
    const areaStatusMap: Record<string, boolean> = {}

    if (areaDeptsData) {
      areaDeptsData.forEach((row: any) => {
        if (row.is_active) {
          if (!deptAvailabilityMap[row.department_name]) {
            deptAvailabilityMap[row.department_name] = []
          }
          deptAvailabilityMap[row.department_name].push(row.area)
        }
        if (area && row.area === area) {
          areaStatusMap[row.department_name] = row.is_active
        }
      })
    }

    return NextResponse.json({
      departments: departmentsList,
      areaStatusMap,
      deptAvailabilityMap
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role, area').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — Admin access required' }, { status: 403 })
    }

    const { area, department_name, is_active } = await req.json()
    if (!area || !department_name) {
      return NextResponse.json({ error: 'Area and department_name are required' }, { status: 400 })
    }

    // Strict area authorization: Area admin can only configure their own area
    if (profile.area !== 'Headquarters' && profile.area !== area) {
      return NextResponse.json({ error: 'Forbidden — You can only manage departments in your area' }, { status: 403 })
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('area_departments')
      .upsert({
        area,
        department_name,
        is_active: Boolean(is_active)
      }, { onConflict: 'area,department_name' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
