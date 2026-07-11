import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    // 1. Fetch Finance Officer's profile area
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, area')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'finance') {
      return NextResponse.json({ error: 'Forbidden — Finance only' }, { status: 403 })
    }

    // 2. Fetch monthly stipend payment cycle requests
    const { data: paymentsData, error: paymentsErr } = await adminClient
      .from('stipend_payments')
      .select(`
        *,
        internship:internships(
          area,
          student:profiles!internships_student_id_fkey(full_name, email, area)
        )
      `)
      .order('created_at', { ascending: false })

    if (paymentsErr) throw paymentsErr

    // Filter payments to area if not Headquarters
    let filteredPayments = paymentsData || []
    if (profile.area && profile.area !== 'Headquarters') {
      filteredPayments = (paymentsData || []).filter(p => p.internship?.area === profile.area)
    }

    // 3. Fetch internships that are "paid" and need bank account verification
    let internsQuery = adminClient
      .from('internships')
      .select(`
        id,
        start_date,
        end_date,
        internship_type,
        bank_name,
        bank_account_no,
        bank_ifsc_code,
        bank_document_url,
        bank_details_status,
        bank_rejection_reason,
        area,
        student:profiles!internships_student_id_fkey(id, full_name, email, area, wing)
      `)
      .eq('internship_type', 'paid')
      .or('bank_details_status.is.null, bank_details_status.neq.verified')

    if (profile.area && profile.area !== 'Headquarters') {
      internsQuery = internsQuery.eq('area', profile.area)
    }

    const { data: internsData, error: internsErr } = await internsQuery
      .order('bank_details_status', { ascending: false }) // show submitted first

    if (internsErr) throw internsErr

    // 4. Fetch internships that are "paid" and are ALREADY verified
    let verifiedQuery = adminClient
      .from('internships')
      .select(`
        id,
        serial_no,
        created_at,
        start_date,
        end_date,
        stipend_amount,
        stipend_frequency,
        bank_name,
        bank_account_no,
        area,
        student:profiles!internships_student_id_fkey(id, full_name, email, area, wing),
        stipend_payments(created_at)
      `)
      .eq('internship_type', 'paid')
      .eq('bank_details_status', 'verified')
      .eq('is_active', true)

    if (profile.area && profile.area !== 'Headquarters') {
      verifiedQuery = verifiedQuery.eq('area', profile.area)
    }

    const { data: verifiedData, error: verifiedErr } = await verifiedQuery

    if (verifiedErr) throw verifiedErr

    const verifiedWithPaymentDate = (verifiedData || []).map((intern: any) => {
      const payments = intern.stipend_payments || []
      const latest = payments.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      return {
        ...intern,
        latest_payment_date: latest?.created_at || null,
        stipend_payments: undefined // remove raw array from response
      }
    })

    return NextResponse.json({
      payments: filteredPayments,
      pending: internsData || [],
      verified: verifiedWithPaymentDate
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
