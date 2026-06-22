import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify requesting user is an admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — Admins only' }, { status: 403 })
    }

    const { applicationId } = await req.json()
    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 1. Fetch the LOR application details
    const { data: app, error: fetchError } = await adminClient
      .from('applications')
      .select('*, referrer:profiles!applications_referred_by_fkey(area)')
      .eq('id', applicationId)
      .maybeSingle()

    if (fetchError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (app.status === 'approved') {
      return NextResponse.json({ error: 'Application is already approved' }, { status: 400 })
    }

    const email = app.student_email
    const full_name = app.student_name

    if (!email || !full_name) {
      return NextResponse.json({ error: 'Application is missing student details (name/email)' }, { status: 400 })
    }

    // 2. Update LOR application status to 'approved'
    const { error: updateError } = await adminClient
      .from('applications')
      .update({ 
        status: 'approved'
      })
      .eq('id', applicationId)

    if (updateError) {
      return NextResponse.json({ error: `Failed to update application: ${updateError.message}` }, { status: 400 })
    }

    // 3. Send approval email without password/credentials, stating credentials will follow shortly
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      try {
        const nodemailer = await import('nodemailer')
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
          },
        })

        const subject = 'Internship Recommendation Approved — MCL'
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <div style="background: #166534; padding: 24px 32px;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">Mahanadi Coalfields Limited</h1>
              <p style="color: #bbf7d0; margin: 4px 0 0; font-size: 13px;">A Subsidiary of Coal India Limited</p>
            </div>
            <div style="padding: 32px;">
              <h2 style="color: #166534; margin-top: 0;">Letter of Recommendation Approved</h2>
              <p>Dear <strong>${full_name.trim()}</strong>,</p>
              <p>We are pleased to inform you that the Letter of Recommendation (LOR) submitted on your behalf has been successfully verified and approved by the Mahanadi Coalfields Limited training administration.</p>
              <p>You have been registered for an internship. Your training placement details are as follows:</p>

              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background: #f0fdf4;">
                  <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600; width: 40%;">Name</td>
                  <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${full_name.trim()}</td>
                </tr>
                ${app.roll_no ? `<tr>
                  <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Roll Number</td>
                  <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${app.roll_no}</td>
                </tr>` : ''}
                ${app.university ? `<tr style="background: #f0fdf4;">
                  <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">University / College</td>
                  <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${app.university}</td>
                </tr>` : ''}
                <tr style="background: #f0fdf4;">
                  <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Training Location</td>
                  <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600; color: #166534;">${app.referrer?.area || 'General'} Area, MCL</td>
                </tr>
              </table>

              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #374151;">Important Update</p>
                <p style="margin: 8px 0 0; font-size: 14px; color: #166534; font-weight: 600;">Your further login credentials for the internship portal will be sent shortly.</p>
                <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Once generated, you can log in to view assignments, attendance tracking, and materials.</p>
              </div>

              <p>You are requested to report to the training office at <strong>${app.referrer?.area || 'Talcher'} Area</strong> to coordinate your start date.</p>
              <p>We wish you a productive and enriching internship experience.</p>

              <br/>
              <p style="margin: 0;">Regards,</p>
              <p style="margin: 4px 0;"><strong>Training & Development Department</strong></p>
              <p style="margin: 4px 0; color: #6b7280;">Mahanadi Coalfields Limited</p>
            </div>
            <div style="background: #f9fafb; padding: 12px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">This is an automated email from the MCL Internship Portal. Please do not reply.</p>
            </div>
          </div>
        `

        await transporter.sendMail({
          from: `"MCL Internship Portal" <${process.env.GMAIL_USER}>`,
          to: email.toLowerCase().trim(),
          subject: subject,
          html: htmlContent
        })
        console.log(`[APPROVE-LOR] Student notification and welcome email sent to ${email}`)
      } catch (mailErr: any) {
        console.error(`[APPROVE-LOR] Failed to send student email:`, mailErr.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
