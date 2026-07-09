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
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { subject, description } = await req.json()
    if (!subject || !description) {
      return NextResponse.json({ error: 'Missing subject or description' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    // Find active/recent internship
    const { data: internship } = await adminClient
      .from('internships')
      .select('id')
      .eq('student_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    const { error } = await adminClient
      .from('grievances')
      .insert({
        student_id: user.id,
        internship_id: internship?.id || null,
        subject,
        description,
        status: 'open'
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
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

    if (profile.role === 'student') {
      const { data, error } = await adminClient
        .from('grievances')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ data })
    } else if (profile.role === 'admin') {
      let query = adminClient
        .from('grievances')
        .select(`
          *,
          student:profiles!grievances_student_id_fkey(full_name, area, university)
        `)
        .order('created_at', { ascending: false })

      const { data, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Filter by area if not HQ admin
      const filtered = profile.area === 'Headquarters'
        ? data
        : data?.filter((g: any) => g.student?.area === profile.area)

      return NextResponse.json({ data: filtered })
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
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

    const { grievance_id, status, admin_response } = await req.json()
    if (!grievance_id || !status) {
      return NextResponse.json({ error: 'Missing grievance_id or status' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Retrieve grievance first to check area
    const { data: grievance } = await adminClient
      .from('grievances')
      .select(`
        *,
        student:profiles!grievances_student_id_fkey(area, email)
      `)
      .eq('id', grievance_id)
      .maybeSingle()

    if (!grievance) return NextResponse.json({ error: 'Grievance not found' }, { status: 404 })

    // Check area restriction
    if (profile.area !== 'Headquarters' && grievance.student?.area !== profile.area) {
      return NextResponse.json({ error: 'Forbidden — Area Admin mismatch' }, { status: 403 })
    }

    const updateData: any = {
      status,
      admin_response
    }

    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString()
    }

    const { error } = await adminClient
      .from('grievances')
      .update(updateData)
      .eq('id', grievance_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Send email notification on update
    if (grievance.student?.email) {
      try {
        if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
          const nodemailer = await import('nodemailer')
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_PASS,
            },
          })

          const mailOptions = {
            from: `"MCL Internship Portal" <${process.env.GMAIL_USER}>`,
            to: grievance.student.email,
            subject: `Update on Grievance Redressal — MCL Portal`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #166534; margin-top: 0;">Grievance Redressal Update</h2>
                <p>Hello,</p>
                <p>Your submitted grievance regarding <strong>"${grievance.subject}"</strong> has been updated.</p>
                <div style="background-color: #f9fafb; padding: 15px; border-left: 4px solid #166534; margin: 15px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px;"><strong>New Status:</strong> <span style="text-transform: uppercase; font-weight: bold;">${status}</span></p>
                  ${admin_response ? `<p style="margin: 8px 0 0; font-size: 14px;"><strong>Admin Response:</strong> ${admin_response}</p>` : ''}
                </div>
                <p style="font-size: 13px; color: #6b7280;">This is an automated notification. Please do not reply directly to this email.</p>
              </div>
            `
          }

          await transporter.sendMail(mailOptions)
        }
      } catch (mailError) {
        console.error('Failed to send grievance update email:', mailError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
