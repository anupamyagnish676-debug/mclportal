import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import { generatePaySlip } from '@/lib/generate-payslip'

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
      // Get student's active internship
      const { data: internship } = await adminClient
        .from('internships')
        .select('id')
        .eq('student_id', user.id)
        .maybeSingle()

      if (!internship) return NextResponse.json({ data: [] })

      const { data, error } = await adminClient
        .from('stipend_payments')
        .select('*')
        .eq('internship_id', internship.id)
        .order('created_at', { ascending: false })

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ data })
    } else if (profile.role === 'finance' || profile.role === 'admin') {
      let query = adminClient
        .from('stipend_payments')
        .select(`
          *,
          internship:internships(
            area,
            serial_no,
            student:profiles!internships_student_id_fkey(full_name, university, wing)
          )
        `)
        .order('created_at', { ascending: false })

      const { data: payments, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Filter by area if area admin
      let filtered = payments || []
      if (profile.role === 'admin' && profile.area !== 'Headquarters') {
        filtered = payments?.filter((p: any) => p.internship?.area === profile.area) || []
      }

      return NextResponse.json({ data: filtered })
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, area')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'finance')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { internship_id, period_label, amount } = await req.json()
    if (!internship_id || !period_label) {
      return NextResponse.json({ error: 'Missing internship_id or period_label' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Retrieve internship to check area and stipend amount
    const { data: internship } = await adminClient
      .from('internships')
      .select('area, stipend_amount')
      .eq('id', internship_id)
      .maybeSingle()

    if (!internship) return NextResponse.json({ error: 'Internship not found' }, { status: 404 })

    // Area mismatch check (for non-HQ officers)
    if (profile.area && profile.area !== 'Headquarters' && internship.area !== profile.area) {
      return NextResponse.json({ error: 'Forbidden — Area mismatch' }, { status: 403 })
    }

    const finalAmount = amount !== undefined ? parseFloat(amount) : (internship.stipend_amount || 0)

    // Check for duplicate period — block if same internship + period_label already exists
    const { data: existingCycle } = await adminClient
      .from('stipend_payments')
      .select('id')
      .eq('internship_id', internship_id)
      .eq('period_label', period_label)
      .maybeSingle()

    if (existingCycle) {
      return NextResponse.json(
        { error: `Stipend cycle for "${period_label}" has already been requested for this student.` },
        { status: 400 }
      )
    }

    const { error } = await adminClient
      .from('stipend_payments')
      .insert({
        internship_id,
        period_label,
        amount: finalAmount,
        status: 'pending'
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
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
      .select('role, area, full_name, signature_data')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'finance') {
      return NextResponse.json({ error: 'Forbidden — Finance only' }, { status: 403 })
    }

    const body = await req.json()
    const { payment_id, status, remarks, internship_id, action, amount, frequency, rejection_reason } = body

    const adminClient = createAdminClient()

    if (action === 'verify_bank') {
      if (!internship_id || !status) {
        return NextResponse.json({ error: 'Missing internship_id or status' }, { status: 400 })
      }

      // Check area mismatch for non-HQ Finance officers
      const { data: internship } = await adminClient
        .from('internships')
        .select('area')
        .eq('id', internship_id)
        .maybeSingle()

      if (!internship) return NextResponse.json({ error: 'Internship not found' }, { status: 404 })

      if (profile.area && profile.area !== 'Headquarters' && internship.area !== profile.area) {
        return NextResponse.json({ error: 'Forbidden — Area mismatch' }, { status: 403 })
      }

      if (status === 'verified') {
        if (amount === undefined || !frequency) {
          return NextResponse.json({ error: 'Amount and frequency are required for verification' }, { status: 400 })
        }
        const { error } = await adminClient
          .from('internships')
          .update({
            stipend_amount: parseFloat(amount) || 0,
            stipend_frequency: frequency,
            bank_details_status: 'verified',
            bank_rejection_reason: null
          })
          .eq('id', internship_id)

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ success: true })
      } else if (status === 'rejected') {
        const { error } = await adminClient
          .from('internships')
          .update({
            bank_details_status: 'rejected',
            bank_rejection_reason: rejection_reason || 'Bank details document could not be verified'
          })
          .eq('id', internship_id)

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ success: true })
      } else {
        return NextResponse.json({ error: 'Invalid verification status' }, { status: 400 })
      }
    }

    if (!payment_id || !status) {
      return NextResponse.json({ error: 'Missing payment_id or status' }, { status: 400 })
    }

    // Check area mismatch for non-HQ Finance officers on payment cycles
    const { data: paymentRecord } = await adminClient
      .from('stipend_payments')
      .select('*, internship:internships(area)')
      .eq('id', payment_id)
      .maybeSingle()

    if (!paymentRecord) return NextResponse.json({ error: 'Payment record not found' }, { status: 404 })

    if (profile.area && profile.area !== 'Headquarters' && paymentRecord.internship?.area !== profile.area) {
      return NextResponse.json({ error: 'Forbidden — Area mismatch' }, { status: 403 })
    }

    const updateData: any = { status, remarks }

    if (status === 'approved') {
      updateData.approved_by = user.id
    } else if (status === 'disbursed') {
      updateData.disbursed_at = new Date().toISOString()
    }

    const { error } = await adminClient
      .from('stipend_payments')
      .update(updateData)
      .eq('id', payment_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // --- Send disbursement email when status is 'disbursed' ---
    if (status === 'disbursed' && process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      try {
        // Fetch full payment + internship + student + mentor details
        const { data: fullPayment } = await adminClient
          .from('stipend_payments')
          .select(`
            period_label,
            amount,
            remarks,
            disbursed_at,
            internship:internships(
              id,
              serial_no,
              area,
              bank_name,
              bank_account_no,
              bank_ifsc_code,
              start_date,
              end_date,
              mentor_id,
              student:profiles!internships_student_id_fkey(full_name, email, university, wing, area)
            )
          `)
          .eq('id', payment_id)
          .maybeSingle() as { data: any }

        if (fullPayment) {
          const studentEmail = fullPayment.internship?.student?.email
          const studentName = fullPayment.internship?.student?.full_name
          const serialNo = fullPayment.internship?.serial_no
          const mclInternshipId = serialNo ? `MCL/HRD/INT/${serialNo}` : fullPayment.internship?.id
          const area = fullPayment.internship?.area
          const bankName = fullPayment.internship?.bank_name
          const accountNo = fullPayment.internship?.bank_account_no
          const lastFour = accountNo ? accountNo.slice(-4) : '****'
          const amount = fullPayment.amount
          const period = fullPayment.period_label
          const utr = fullPayment.remarks || 'N/A'

          // Collect CC recipients: Area Admins + Mentor
          const ccEmails: string[] = []

          // Fetch area admins
          if (area) {
            const { data: areaAdmins } = await adminClient
              .from('profiles')
              .select('email')
              .eq('role', 'admin')
              .eq('area', area)
            areaAdmins?.forEach((a: any) => { if (a.email) ccEmails.push(a.email) })
          }

          // Fetch mentor
          if (fullPayment.internship?.mentor_id) {
            const { data: mentor } = await adminClient
              .from('profiles')
              .select('email')
              .eq('id', fullPayment.internship.mentor_id)
              .maybeSingle()
            if (mentor?.email) ccEmails.push(mentor.email)
          }

          // Generate Stipend Receipt (Pay Slip) PDF
          let pdfBuffer: Buffer | null = null
          try {
            pdfBuffer = await generatePaySlip({
              studentName: studentName || 'Intern',
              university: fullPayment.internship?.student?.university || 'their respective institution',
              wing: fullPayment.internship?.student?.wing || 'Training Wing',
              serialNo: serialNo || 'N/A',
              startDate: fullPayment.internship?.start_date,
              endDate: fullPayment.internship?.end_date,
              periodLabel: period,
              amount: amount,
              bankName: bankName || 'N/A',
              accountNo: accountNo || 'N/A',
              ifscCode: fullPayment.internship?.bank_ifsc_code || 'N/A',
              utr: utr,
              disbursedAt: fullPayment.disbursed_at || new Date().toISOString(),
              financeOfficerName: profile?.full_name || 'Finance Officer',
              financeOfficerSignature: profile?.signature_data || null,
              origin: req.nextUrl.origin
            })
          } catch (pdfErr) {
            console.error('Failed to generate stipend payslip PDF:', pdfErr)
          }

          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
          })

          await transporter.sendMail({
            from: `"MCL Internship Portal" <${process.env.GMAIL_USER}>`,
            to: studentEmail,
            cc: ccEmails.length > 0 ? ccEmails.join(',') : undefined,
            subject: `Stipend Disbursed for ${period} — Mahanadi Coalfields Limited`,
            attachments: pdfBuffer ? [
              {
                filename: `Stipend_PaySlip_${period.replace(/\s+/g, '_')}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
              }
            ] : undefined,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <div style="background: #166534; padding: 24px 32px; color: #fff;">
                  <h2 style="margin: 0;">Mahanadi Coalfields Limited</h2>
                  <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.8;">Stipend Disbursement Notification</p>
                </div>
                <div style="padding: 32px; color: #374151;">
                  <p>Dear <strong>${studentName}</strong>,</p>
                  <p>We are pleased to inform you that your stipend for the period <strong>${period}</strong> has been successfully disbursed to your registered bank account. We have attached your payment advice slip (Pay Slip) to this email.</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                    <tr style="background: #f9fafb;">
                      <td style="padding: 10px 14px; font-weight: bold; border: 1px solid #e5e7eb;">Internship ID</td>
                      <td style="padding: 10px 14px; border: 1px solid #e5e7eb;">${mclInternshipId}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 14px; font-weight: bold; border: 1px solid #e5e7eb;">Period</td>
                      <td style="padding: 10px 14px; border: 1px solid #e5e7eb;">${period}</td>
                    </tr>
                    <tr style="background: #f9fafb;">
                      <td style="padding: 10px 14px; font-weight: bold; border: 1px solid #e5e7eb;">Amount Disbursed</td>
                      <td style="padding: 10px 14px; border: 1px solid #e5e7eb; color: #166534; font-weight: bold;">₹${amount?.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 14px; font-weight: bold; border: 1px solid #e5e7eb;">Bank</td>
                      <td style="padding: 10px 14px; border: 1px solid #e5e7eb;">${bankName || 'N/A'} (A/C ending ****${lastFour})</td>
                    </tr>
                    <tr style="background: #f9fafb;">
                      <td style="padding: 10px 14px; font-weight: bold; border: 1px solid #e5e7eb;">Transaction Ref / UTR</td>
                      <td style="padding: 10px 14px; border: 1px solid #e5e7eb;">${utr}</td>
                    </tr>
                  </table>
                  <p style="font-size: 13px; color: #6b7280;">Please verify the credit in your bank account using the UTR reference number above. If you have any queries, please contact the Finance Department.</p>
                  <br/>
                  <p>Regards,<br/><strong>Finance Department</strong><br/>Mahanadi Coalfields Limited</p>
                </div>
              </div>
            `,
          })
        }
      } catch (emailErr: any) {
        // Email failure should not block the disbursement response
        console.error('Disbursement email failed:', emailErr.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
