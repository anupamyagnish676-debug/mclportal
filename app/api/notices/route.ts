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
      .select('role, area, full_name')
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

    // Send email notification to targeted recipients
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      try {
        let recipientQuery = adminClient
          .from('profiles')
          .select('email, full_name')
          .in('role', finalRoles)
          .not('email', 'is', null)

        if (!finalAreas.includes('all')) {
          recipientQuery = recipientQuery.in('area', finalAreas)
        }

        const { data: recipients, error: fetchErr } = await recipientQuery

        if (fetchErr) {
          console.error('[NOTICES] Failed to fetch notice recipients:', fetchErr.message)
        } else if (recipients && recipients.length > 0) {
          const nodemailer = await import('nodemailer')
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_PASS,
            },
          })

          const subject = priority === 'urgent'
            ? `🚨 [URGENT] MCL Notice Board: ${title}`
            : `📢 MCL Notice Board: ${title}`

          const emailPromises = recipients.map(async (r: any) => {
            if (!r.email) return

            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <div style="background: #166534; padding: 24px 32px; color: #fff;">
                  <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #ffffff;">
                    ${priority === 'urgent' ? '🚨 URGENT NOTICE' : '📢 NOTICE'}
                  </span>
                  <h1 style="margin: 8px 0 0; font-size: 20px; font-weight: bold; line-height: 1.3; color: #ffffff;">${title}</h1>
                  <p style="margin: 6px 0 0; font-size: 12px; opacity: 0.85; color: #ffffff;">
                    Source: <strong>${profile.area} Area</strong> | Posted by: ${profile.full_name || 'Admin'}
                  </p>
                </div>
                <div style="padding: 32px; color: #374151; background: #ffffff;">
                  <p style="margin-top: 0; font-size: 15px; font-weight: bold; color: #111827;">
                    Dear ${r.full_name || 'User'},
                  </p>
                  <div style="font-size: 15px; line-height: 1.6; white-space: pre-wrap; color: #1f2937; margin-bottom: 24px;">
                    ${content}
                  </div>
                  
                  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                  
                  <div style="text-align: center; margin-top: 24px;">
                    <a href="${req.nextUrl.origin}/login" style="display: inline-block; background-color: #166534; color: #ffffff; padding: 12px 24px; font-weight: bold; font-size: 14px; text-decoration: none; border-radius: 8px;">
                      View on Internship Portal
                    </a>
                  </div>
                </div>
                <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #6b7280;">
                  This is an automated notification from Mahanadi Coalfields Limited (MCL) Internship Portal. Please do not reply directly to this email.
                </div>
              </div>
            `

            try {
              await transporter.sendMail({
                from: `"MCL Notice Board" <${process.env.GMAIL_USER}>`,
                to: r.email,
                subject,
                html: emailHtml,
              })
            } catch (err: any) {
              console.error(`[NOTICES] Failed to send email to ${r.email}:`, err.message)
            }
          })

          await Promise.all(emailPromises)
          console.log(`[NOTICES] Personal email notifications dispatched to ${recipients.length} recipients.`)
        }
      } catch (err: any) {
        console.error('[NOTICES] Error sending notification email:', err.message)
      }
    }

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
