import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { saveStudentLogbookToGDrive, getStudentLogbookFromGDrive } from '@/lib/gdrive'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient.from('profiles').select('full_name, area').eq('id', user.id).maybeSingle()
    const { data: internship } = await adminClient.from('internships').select('id, serial_no, area, start_date, end_date').eq('student_id', user.id).maybeSingle()

    if (!profile || !internship) {
      return NextResponse.json({ error: 'Internship not found' }, { status: 404 })
    }

    const logs = await getStudentLogbookFromGDrive({
      studentName: profile.full_name,
      studentId: user.id,
      serialNo: internship.serial_no,
      area: internship.area || profile.area
    })

    return NextResponse.json({ logs, internship })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { date, content } = await req.json()
    if (!date || !content || !content.trim()) {
      return NextResponse.json({ error: 'Missing date or content' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient.from('profiles').select('full_name, area').eq('id', user.id).maybeSingle()
    const { data: internship } = await adminClient.from('internships').select('id, serial_no, area, start_date, end_date').eq('student_id', user.id).maybeSingle()

    if (!profile || !internship) {
      return NextResponse.json({ error: 'Internship not found' }, { status: 404 })
    }

    // Date range validation
    const dateVal = new Date(date)
    const start = new Date(internship.start_date)
    const end = new Date(internship.end_date)
    if (dateVal < start || dateVal > end) {
      return NextResponse.json({ 
        error: `Selected date must be within your internship period (${internship.start_date} to ${internship.end_date}).` 
      }, { status: 400 })
    }

    // Save directly into Google Drive (Daily_Logbook.json) inside Student Folder
    await saveStudentLogbookToGDrive({
      studentName: profile.full_name,
      studentId: user.id,
      serialNo: internship.serial_no,
      area: internship.area || profile.area,
      date,
      content: content.trim()
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
