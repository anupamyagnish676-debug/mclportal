import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify requesting user is an employee or admin
    const { data: profile } = await supabase.from('profiles').select('role, area').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'employee' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — Employee or Admin only' }, { status: 403 })
    }

    const { studentEmail, studentName, lorUrl, employeeCode, rollNo, university } = await req.json()
    if (!studentEmail || !studentName || !lorUrl || !employeeCode || !rollNo || !university) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 1. Resolve student ID if a profile already exists for this email
    let { data: student } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', studentEmail.trim().toLowerCase())
      .maybeSingle()

    const studentId = student?.id || null

    // 2. Insert LOR application, storing student info and employee code in applications table
    const { error: insertError } = await adminClient.from('applications').insert({
      student_id: studentId,
      student_name: studentName.trim(),
      student_email: studentEmail.trim().toLowerCase(),
      employee_code: employeeCode.trim(),
      roll_no: rollNo.trim(),
      university: university.trim(),
      referred_by: user.id,
      lor_url: lorUrl,
      status: 'pending',
    })

    if (insertError) {
      return NextResponse.json({ error: `Failed to insert application: ${insertError.message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
