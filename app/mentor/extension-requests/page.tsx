import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import MentorExtensionActions from './MentorExtensionActions'

export default async function MentorExtensionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'mentor') redirect('/login')

  const adminClient = createAdminClient()

  // Fetch extension requests for internships assigned to this mentor
  const { data: requests } = await adminClient
    .from('extension_requests')
    .select(`
      id,
      requested_end_date,
      reason,
      mentor_status,
      mentor_remarks,
      student_id,
      internship:internships!inner(mentor_id),
      student:profiles!extension_requests_student_id_fkey(full_name, university)
    `)
    .eq('internships.mentor_id', user.id)
    .order('created_at', { ascending: false })

  const typedRequests = (requests || []).map((r: any) => ({
    id: r.id,
    requested_end_date: r.requested_end_date,
    reason: r.reason,
    mentor_status: r.mentor_status,
    mentor_remarks: r.mentor_remarks,
    student: {
      full_name: r.student?.full_name || 'N/A',
      university: r.student?.university || 'N/A'
    }
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Extension Requests</h1>
        <p className="text-sm text-gray-500">Approve or reject internship duration extension requests from your interns.</p>
      </div>

      <MentorExtensionActions initialRequests={typedRequests} />
    </div>
  )
}
