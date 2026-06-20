import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const step = searchParams.get('step') || '1'
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Step 6: Check ALL tables and columns
  if (step === '6') {
    const tables = ['profiles', 'applications', 'internships', 'attendance', 'assignments', 'materials']
    const results: Record<string, any> = {}

    for (const table of tables) {
      const { data, error } = await admin.from(table).select('*').limit(1)
      if (error) {
        results[table] = { exists: false, error: error.message, code: error.code }
      } else {
        results[table] = {
          exists: true,
          columns: data && data.length > 0 ? Object.keys(data[0]) : 'empty table',
          row_count_sample: data?.length
        }
      }
    }

    return NextResponse.json(results)
  }

  // Step 7: Simulate admin page load — test all the queries the admin page makes
  if (step === '7') {
    // Sign in as admin first
    const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: authData, error: authErr } = await anon.auth.signInWithPassword({ email: 'admin@mcl.com', password: 'Admin@1234' })
    if (authErr) return NextResponse.json({ error: 'Auth failed: ' + authErr.message })

    const userId = authData.user!.id
    const results: Record<string, any> = {}

    // Admin layout query
    const { data: profile, error: profErr } = await anon.from('profiles').select('role, full_name').eq('id', userId).maybeSingle()
    results.layout_profile = profErr ? { error: profErr.message } : profile

    // Admin dashboard queries
    const { count: c1, error: e1 } = await anon.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student')
    results.student_count = e1 ? { error: e1.message } : { count: c1 }

    const { count: c2, error: e2 } = await anon.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    results.pending_apps = e2 ? { error: e2.message } : { count: c2 }

    const { count: c3, error: e3 } = await anon.from('internships').select('*', { count: 'exact', head: true }).eq('is_active', true)
    results.active_internships = e3 ? { error: e3.message } : { count: c3 }

    return NextResponse.json(results)
  }

  return NextResponse.json({ error: 'pass ?step=6 or 7' })
}
