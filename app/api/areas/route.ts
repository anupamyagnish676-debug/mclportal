import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_AREAS = [
  { name: 'Talcher' },
  { name: 'Jagannath' },
  { name: 'Lingaraj' },
  { name: 'Subhadra' },
  { name: 'Headquarters' }
]

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('areas')
      .select('id, name, created_at')
      .order('name', { ascending: true })

    if (error) {
      console.warn('[GET-AREAS] Table not found or error, using defaults:', error.message)
      // Map to same object structure
      return NextResponse.json({ areas: DEFAULT_AREAS.map((a, i) => ({ id: `default-${i}`, name: a.name, created_at: new Date().toISOString() })) })
    }

    return NextResponse.json({ areas: data || [] })
  } catch (err: any) {
    console.error('[GET-AREAS] Unexpected error:', err.message)
    return NextResponse.json({ areas: DEFAULT_AREAS.map((a, i) => ({ id: `default-${i}`, name: a.name, created_at: new Date().toISOString() })) })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    const { name } = await req.json()
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Area name is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { error: insertError } = await adminClient
      .from('areas')
      .insert({ name: name.trim() })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Area ID is required' }, { status: 400 })

    const adminClient = createAdminClient()
    const { error: deleteError } = await adminClient
      .from('areas')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
