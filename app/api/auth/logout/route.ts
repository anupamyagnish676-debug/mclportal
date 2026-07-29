import { NextResponse, type NextRequest } from 'next/server'
import { logAudit, getClientIp } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  // Parse optional reason from body
  let reason = 'manual'
  try {
    const body = await request.json()
    reason = body?.reason || 'manual'
  } catch {}

  // Get current user for audit log
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      await logAudit({
        userId: user.id,
        userEmail: user.email,
        role: profile?.role,
        action: 'LOGOUT',
        details: { reason },
        ip,
      })
    }
  } catch {}

  const response = NextResponse.json({ ok: true })
  // Clear all session cookies
  response.cookies.set('mcl-session', '', { path: '/', maxAge: 0 })
  response.cookies.set('mcl-session-nonce', '', { path: '/', maxAge: 0 })
  return response
}
