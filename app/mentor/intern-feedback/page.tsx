import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import MentorFeedbackForm from './MentorFeedbackForm'

export default async function MentorFeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'mentor') redirect('/login')

  // Fetch all internships assigned to this mentor
  const adminClient = createAdminClient()
  const { data: internships } = await adminClient
    .from('internships')
    .select(`
      id,
      start_date,
      end_date,
      student:profiles!internships_student_id_fkey(id, full_name, university, wing)
    `)
    .eq('mentor_id', user.id)

  // Fetch feedback records for all these internships
  const internshipIds = internships?.map(i => i.id) || []
  let feedbackList: any[] = []

  if (internshipIds.length > 0) {
    const { data } = await adminClient
      .from('internship_feedback')
      .select('internship_id, mentor_rating, mentor_comments')
      .in('internship_id', internshipIds)
    feedbackList = data || []
  }

  // Combine data
  const combinedInternships = (internships || []).map((i: any) => {
    const fb = feedbackList.find(f => f.internship_id === i.id)
    return {
      ...i,
      feedback: fb || { mentor_rating: null, mentor_comments: null }
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Evaluate Interns</h1>
        <p className="text-sm text-gray-500">Assess and provide performance ratings for students under your guidance.</p>
      </div>

      <MentorFeedbackForm internships={combinedInternships} />
    </div>
  )
}
