import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateStudentFolder, isGDriveConfigured } from '@/lib/gdrive'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: adminProfile } = await supabase.from('profiles').select('id, role, area, full_name').eq('id', user.id).maybeSingle()
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — Admin access required' }, { status: 403 })
    }

    const { studentId, candidateName, candidateEmail, rollNo, university, wing, targetArea, reason, lorUrl: requestLorUrl } = await req.json()
    if (!targetArea || (!studentId && (!candidateEmail || !candidateName))) {
      return NextResponse.json({ error: 'Target Area and candidate details (Name, Email) or Student ID are required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const defaultLorUrl = 'https://mclportal.vercel.app/sample-lor.pdf'
    const lorUrl = requestLorUrl || defaultLorUrl

    // Scenario A: Existing student account
    if (studentId) {
      const { data: studentProfile } = await adminClient.from('profiles').select('*').eq('id', studentId).maybeSingle()
      if (!studentProfile) {
        return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
      }

      const previousArea = studentProfile.area || 'Unassigned'

      if (adminProfile.area !== 'Headquarters' && adminProfile.area?.trim().toLowerCase() !== previousArea?.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden — You can only shift students belonging to your area' }, { status: 403 })
      }

      await adminClient.from('profiles').update({ area: targetArea }).eq('id', studentId)

      const { data: existingApp } = await adminClient
        .from('applications')
        .select('id, lor_url')
        .eq('student_id', studentId)
        .maybeSingle()

      if (existingApp) {
        await adminClient
          .from('applications')
          .update({
            status: 'pending_area',
            target_area: targetArea,
            referred_by: adminProfile.id,
            lor_url: lorUrl,
            applied_at: new Date().toISOString()
          })
          .eq('id', existingApp.id)
      } else {
        await adminClient
          .from('applications')
          .insert({
            student_id: studentId,
            student_name: studentProfile.full_name,
            student_email: studentProfile.email,
            referred_by: adminProfile.id,
            target_area: targetArea,
            lor_url: lorUrl,
            status: 'pending_area',
            roll_no: studentProfile.roll_no || null,
            university: studentProfile.university || null
          })
      }
    } else {
      // Scenario B: New candidate referral being forwarded to target area
      await adminClient
        .from('applications')
        .insert({
          student_name: candidateName,
          student_email: candidateEmail,
          referred_by: adminProfile.id,
          target_area: targetArea,
          lor_url: lorUrl,
          status: 'pending_area',
          roll_no: rollNo || null,
          university: university || null
        })
    }

    // 3. Reset or update active internships table (Deactivate & unassign mentor until Target Area approves)
    const { data: internship } = await adminClient
      .from('internships')
      .select('id, serial_no')
      .eq('student_id', studentId)
      .maybeSingle()

    if (internship) {
      await adminClient
        .from('internships')
        .update({ 
          area: targetArea,
          mentor_id: null,
          is_active: false // Deactivated until Target Area Admin approves LoR application & assigns new local mentor
        })
        .eq('id', internship.id)
    }

    const targetCandidateName = studentId ? (await adminClient.from('profiles').select('full_name').eq('id', studentId).single()).data?.full_name : candidateName
    const targetCandidateEmail = studentId ? (await adminClient.from('profiles').select('email').eq('id', studentId).single()).data?.email : candidateEmail

    // 4. Migrate/Create Google Drive subfolder under the new target Area
    if (studentId && isGDriveConfigured()) {
      try {
        await getOrCreateStudentFolder({
          studentName: targetCandidateName || 'Student',
          studentId: studentId,
          serialNo: null,
          area: targetArea
        })
      } catch (err: any) {
        console.error('[SHIFT-AREA] Error setting up Google Drive folder under new area:', err.message)
      }
    }

    // 5. Send Email Notification to Candidate
    if (targetCandidateEmail) {
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mclportal.vercel.app'
        await fetch(`${siteUrl}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: targetCandidateEmail,
            subject: `MCL Internship Portal — LoR Application Forwarded to ${targetArea} Area Admin`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; color: #111827;">
                <h2 style="color: #065f46;">MCL Training Area Transfer Notification</h2>
                <p>Dear <strong>${targetCandidateName || 'Candidate'}</strong>,</p>
                <p>Your internship application and Letter of Recommendation (LoR) have been forwarded to <strong>${targetArea} Area Admin</strong> for approval.</p>
                ${reason ? `<p><strong>Transfer Reason:</strong> ${reason}</p>` : ''}
                <p>Your department / wing (${wing || 'Technical'}) is actively configured at <strong>${targetArea} Area</strong>.</p>
                <p><strong>Next Steps:</strong></p>
                <ul>
                  <li>The ${targetArea} Area Admin will review your LoR application under <strong>Applications Inbox</strong>.</li>
                  <li>Upon approval, complete your document verification and mentor assignment.</li>
                </ul>
                <br/>
                <p style="font-size: 12px; color: #6b7280;">Mahanadi Coalfields Limited • HRD Department</p>
              </div>
            `
          })
        })
      } catch (e) {
        console.warn('[SHIFT-AREA] Email notification skipped or failed:', e)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Candidate ${targetCandidateName} shifted to ${targetArea} Area. LoR application forwarded to ${targetArea} Admin inbox for review & approval.`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
