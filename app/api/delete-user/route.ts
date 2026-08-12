import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    const { studentId, internshipId } = await req.json()

    if (!studentId) {
      return NextResponse.json({ error: 'Missing student ID' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 0. Fetch full student profile and internship for certificate snapshot preservation
    const { data: stuProfile } = await adminClient
      .from('profiles')
      .select('full_name, email, university, roll_no, wing, area')
      .eq('id', studentId)
      .maybeSingle()

    const { data: stuInternship } = await adminClient
      .from('internships')
      .select('id, serial_no, area, start_date, end_date, certificate_url, certificate_approved')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle()

    // Preserve permanent Certificate snapshot in verified_certificates table before deleting account
    if (stuInternship?.serial_no) {
      try {
        await adminClient.from('verified_certificates').upsert({
          serial_no: String(stuInternship.serial_no),
          full_name: stuProfile?.full_name || 'Intern',
          university: stuProfile?.university || '',
          roll_no: stuProfile?.roll_no || '',
          wing: stuProfile?.wing || '',
          area: stuInternship.area || stuProfile?.area || 'Headquarters',
          start_date: stuInternship.start_date,
          end_date: stuInternship.end_date,
          certificate_url: stuInternship.certificate_url || '',
          is_approved: true,
          issued_at: new Date().toISOString(),
        }, { onConflict: 'serial_no' })
      } catch (certSnapshotErr: any) {
        console.warn('[DELETE_USER] Certificate snapshot preserve notice:', certSnapshotErr.message)
      }
    }

    // Delete student folder from Google Drive if configured
    if (stuProfile) {
      try {
        const { deleteStudentFolderGDrive } = await import('@/lib/gdrive')
        await deleteStudentFolderGDrive({
          studentName: stuProfile.full_name,
          studentId: studentId,
          serialNo: stuInternship?.serial_no,
          area: stuProfile.area || stuInternship?.area,
        })
      } catch (gdriveErr: any) {
        console.warn('[DELETE_USER] GDrive cleanup notice:', gdriveErr.message)
      }
    }

    // 1. Delete student operational data (submissions, attendance, leaves, logbooks, materials, internships)
    // Note: verified_certificates is explicitly PRESERVED so physical certificate QR verification remains valid forever.
    if (internshipId || stuInternship?.id) {
      const targetInternshipId = internshipId || stuInternship?.id
      await adminClient.from('submissions').delete().eq('student_id', studentId)
      await adminClient.from('attendance').delete().eq('internship_id', targetInternshipId)
      await adminClient.from('leaves').delete().eq('internship_id', targetInternshipId)
      await adminClient.from('logbooks').delete().eq('internship_id', targetInternshipId)
      await adminClient.from('materials').delete().eq('internship_id', targetInternshipId)
      await adminClient.from('internships').delete().eq('id', targetInternshipId)
    }

    // Unlink the student from any approved LOR applications
    await adminClient
      .from('applications')
      .update({ student_id: null })
      .eq('student_id', studentId)

    // Unlink this user from any LOR applications where they are the recommender (Employee)
    await adminClient
      .from('applications')
      .update({ referred_by: null })
      .eq('referred_by', studentId)

    // Unlink this user from any internships where they are the guide (Mentor)
    await adminClient
      .from('internships')
      .update({ mentor_id: null })
      .eq('mentor_id', studentId)

    // 2. Delete profile
    await adminClient.from('profiles').delete().eq('id', studentId)

    // 3. Delete from Auth
    const { error: authError } = await adminClient.auth.admin.deleteUser(studentId)

    if (authError) {
      return NextResponse.json({ error: `Auth deletion failed: ${authError.message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
