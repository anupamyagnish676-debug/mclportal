import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // Admin only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, area').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return NextResponse.json({ error: 'Email not configured (GMAIL_USER / GMAIL_PASS missing)' }, { status: 500 })
  }

  const isHQ = profile?.area === 'Headquarters'
  const adminArea = profile?.area || ''

  const {
    subject,
    message,
    roles,
    areas,
  } = await req.json()

  if (!subject?.trim()) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
  if (!message?.trim()) return NextResponse.json({ error: 'Message body is required' }, { status: 400 })

  // ── Server-side area enforcement ─────────────────────────────────────────
  // Area admins can ONLY send to their own area — enforce on server regardless of UI
  let enforcedAreas: string[] = areas
  if (!isHQ) {
    // Ignore whatever areas was sent — always lock to adminArea
    enforcedAreas = [adminArea]
  }

  const admin = createAdminClient()

  // Build query based on filters
  let query = admin
    .from('profiles')
    .select('id, full_name, email, role, area')
    .not('email', 'is', null)

  const filterAll = roles?.includes('all')
  if (!filterAll && roles?.length > 0) {
    query = query.in('role', roles)
  }

  const areaAll = areas?.includes('all')
  if (!areaAll && areas?.length > 0) {
    query = query.in('area', areas)
  }

  const { data: profiles, error } = await query.order('role')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: 'No users found matching your filters' }, { status: 404 })
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })

  const roleLabel: Record<string, string> = {
    admin: 'Administrator', finance: 'Finance Officer',
    mentor: 'Mentor', student: 'Intern / Trainee', employee: 'Employee',
  }

  // Convert plain newlines in message to <br> for HTML
  const messageHtml = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const p of profiles) {
    if (!p.email) continue
    const name = p.full_name || p.email
    const role = roleLabel[p.role] || p.role
    const area = p.area ? ` — ${p.area} Area` : ''

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#166534;padding:24px 32px;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Mahanadi Coalfields Limited</h1>
          <p style="color:#bbf7d0;margin:4px 0 0;font-size:13px;">A Subsidiary of Coal India Limited</p>
        </div>
        <div style="padding:32px;color:#374151;">
          <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;">Dear <strong>${name}</strong> <span style="color:#9ca3af;font-size:12px;">(${role}${area})</span>,</p>
          <div style="margin:20px 0;padding:20px 24px;background:#f9fafb;border-left:4px solid #166534;border-radius:0 8px 8px 0;font-size:14px;line-height:1.7;color:#374151;">
            ${messageHtml}
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="margin:0;font-size:12px;color:#9ca3af;">This message was sent to you by the MCL Internship Portal administration. Please do not reply to this email.</p>
        </div>
        <div style="background:#f9fafb;padding:12px 32px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">MCL Internship Portal &nbsp;|&nbsp; Mahanadi Coalfields Limited</p>
        </div>
      </div>
    `

    try {
      await transporter.sendMail({
        from: `"MCL Internship Portal" <${process.env.GMAIL_USER}>`,
        to: p.email,
        subject: subject.trim(),
        html,
      })
      sent++
      await new Promise(r => setTimeout(r, 400))
    } catch (e: any) {
      failed++
      errors.push(`${p.email}: ${e.message}`)
    }
  }

  return NextResponse.json({ success: true, sent, failed, total: profiles.length, errors })
}

// GET — preview how many users match the current filters
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const roles = searchParams.get('roles')?.split(',').filter(Boolean) || ['all']
  const areas = searchParams.get('areas')?.split(',').filter(Boolean) || ['all']

  let query = admin.from('profiles').select('id, full_name, email, role, area').not('email', 'is', null)

  if (!roles.includes('all') && roles.length > 0) query = query.in('role', roles)
  if (!areas.includes('all') && areas.length > 0) query = query.in('area', areas)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    count: data?.length || 0,
    preview: (data || []).slice(0, 5).map(p => ({ name: p.full_name, email: p.email, role: p.role, area: p.area }))
  })
}
