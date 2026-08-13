import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateStudentFolder, isGDriveConfigured } from '@/lib/gdrive'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: adminProfile } = await supabase.from('profiles').select('role, area, full_name').eq('id', user.id).maybeSingle()
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — Admin access required' }, { status: 403 })
    }

    const { studentId, targetArea, reason } = await req.json()
    if (!studentId || !targetArea) {
      return NextResponse.json({ error: 'studentId and targetArea are required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Fetch target student profile
    const { data: studentProfile } = await adminClient.from('profiles').select('*').eq('id', studentId).maybeSingle()
    if (!studentProfile) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
    }

    const previousArea = studentProfile.area || 'Unassigned'

    // Area admin security check: can only shift student from their own area unless HQ Admin
    if (adminProfile.area !== 'Headquarters' && adminProfile.area !== previousArea) {
      return NextResponse.json({ error: 'Forbidden — You can only shift students belonging to your area' }, { status: 403 })
    }

    // 1. Update profiles table
    const { error: profileErr } = await adminClient
      .from('profiles')
      .update({ area: targetArea })
      .eq('id', studentId)

    if (profileErr) throw profileErr

    // 2. Update active internships table if exists
    const { data: internship } = await adminClient
      .from('internships')
      .select('id, serial_no')
      .eq('student_id', studentId)
      .maybeSingle()

    if (internship) {
      await adminClient
        .from('internships')
        .update({ area: targetArea })
        .eq('id', internship.id)
    }

    // 3. Migrate/Create Google Drive subfolder under the new target Area
    if (isGDriveConfigured()) {
      try {
        await getOrCreateStudentFolder({
          studentName: studentProfile.full_name,
          studentId: studentProfile.id,
          serialNo: internship?.serial_no || null,
          area: targetArea
        })
      } catch (err: any) {
        console.error('[SHIFT-AREA] Error setting up Google Drive folder under new area:', err.message)
      }
    }

    // 4. Send Email Notification to Student
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mclportal.vercel.app'
      await fetch(`${siteUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: studentProfile.email,
          subject: `MCL Internship Portal — Area Transfer to ${targetArea}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #111827;">
              <h2 style="color: #065f46;">MCL Training Area Transfer Notification</h2>
              <p>Dear <strong>${studentProfile.full_name}</strong>,</p>
              <p>Your internship training office area has been transferred from <strong>${previousArea} Area</strong> to <strong>${targetArea} Area</strong>.</p>
              ${reason ? `<p><strong>Reason for Transfer:</strong> ${reason}</p>` : ''}
              <p>Your department / wing (${studentProfile.wing || 'Technical'}) is actively configured at <strong>${targetArea} Area</strong>.</p>
              <p>Please log in to your portal account to view updated area details.</p>
              <br/>
              <p style="font-size: 12px; color: #6b7280;">Mahanadi Coalfields Limited • HRD Department</p>
            </div>
          `
        })
      })
    } catch (e) {
      console.warn('[SHIFT-AREA] Email notification skipped or failed:', e)
    }

    return NextResponse.json({
      success: true,
      message: `Student ${studentProfile.full_name} transferred from ${previousArea} to ${targetArea} successfully.`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
