import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // Admin only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return NextResponse.json({ error: 'Email not configured (GMAIL_USER/GMAIL_PASS missing)' }, { status: 500 })
  }

  // Fetch all profiles that have an email
  const admin = createAdminClient()
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, full_name, email, role, area')
    .not('email', 'is', null)
    .order('role')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: 'No users found' }, { status: 404 })
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })

  const PORTAL_URL = 'https://mclportal.vercel.app/login'

  const roleLabel: Record<string, string> = {
    admin:   'Administrator',
    finance: 'Finance Officer',
    mentor:  'Mentor',
    student: 'Intern / Trainee',
    employee:'Employee',
  }

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
          <h2 style="color:#166534;margin-top:0;">MCL Internship Portal — Important Update</h2>
          <p>Dear <strong>${name}</strong>,</p>
          <p>The MCL Internship Portal has been updated with new features and improvements. Please use the link below to access your account going forward.</p>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:#166534;font-weight:bold;">YOUR PORTAL LINK</p>
            <a href="${PORTAL_URL}" style="font-size:18px;font-weight:bold;color:#166534;text-decoration:none;">${PORTAL_URL}</a>
          </div>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
            <tr style="background:#f9fafb;">
              <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;width:40%;">Name</td>
              <td style="padding:10px 16px;border:1px solid #e5e7eb;">${name}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;">Login Email</td>
              <td style="padding:10px 16px;border:1px solid #e5e7eb;">${p.email}</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;">Role</td>
              <td style="padding:10px 16px;border:1px solid #e5e7eb;">${role}${area}</td>
            </tr>
          </table>

          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e;margin-bottom:20px;">
            <strong>Important:</strong> Please bookmark this link. Your existing password remains the same. If you face any login issues, contact your administrator.
          </div>

          <p style="margin-bottom:4px;">Regards,</p>
          <p style="margin:4px 0;"><strong>Training &amp; Development Department</strong></p>
          <p style="margin:4px 0;color:#6b7280;">Mahanadi Coalfields Limited</p>
        </div>
        <div style="background:#f9fafb;padding:12px 32px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">This is an official communication from MCL Internship Portal. Do not reply to this email.</p>
        </div>
      </div>
    `

    try {
      await transporter.sendMail({
        from: `"MCL Internship Portal" <${process.env.GMAIL_USER}>`,
        to: p.email,
        subject: '📢 MCL Internship Portal — New Link & Updates',
        html,
      })
      sent++
      // Small delay to avoid Gmail rate limiting
      await new Promise(r => setTimeout(r, 400))
    } catch (e: any) {
      failed++
      errors.push(`${p.email}: ${e.message}`)
    }
  }

  return NextResponse.json({ success: true, sent, failed, total: profiles.length, errors })
}
