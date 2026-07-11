import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { internship_id, period_label, amount } = await req.json()
    if (!internship_id || !period_label || !amount) {
      return NextResponse.json({ error: 'Missing internship_id, period_label, or amount' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Retrieve internship to check area match
    const { data: internship } = await adminClient
      .from('internships')
      .select('area')
      .eq('id', internship_id)
      .maybeSingle()

    if (!internship) return NextResponse.json({ error: 'Internship not found' }, { status: 404 })

    // Area admin mismatch check
    if (profile.area !== 'Headquarters' && internship.area !== profile.area) {
      return NextResponse.json({ error: 'Forbidden — Area mismatch' }, { status: 403 })
    }

    const { error } = await adminClient
      .from('stipend_payments')
      .insert({
        internship_id,
        period_label,
        amount,
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
      .select('role')
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
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
