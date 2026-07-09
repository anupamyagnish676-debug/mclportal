import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FeedbackForm from './FeedbackForm'

export default async function StudentFeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'student') redirect('/login')

  // Fetch active/recent internship
  const { data: internship } = await supabase
    .from('internships')
    .select('*')
    .eq('student_id', user.id)
    .maybeSingle()

  if (!internship) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-150 text-center space-y-2">
        <h2 className="text-lg font-bold text-gray-900">No Internship Record Found</h2>
        <p className="text-sm text-gray-500">You are not registered in any internship program yet.</p>
      </div>
    )
  }

  // Fetch existing feedback
  const { data: feedback } = await supabase
    .from('internship_feedback')
    .select('student_rating, student_comments')
    .eq('internship_id', internship.id)
    .maybeSingle()

  // Verify if they are allowed to submit feedback (end date is in past or close to completion)
  const endDate = new Date(internship.end_date)
  const today = new Date()
  const diffTime = endDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  // Allow feedback submission starting 7 days before completion
  const isEligible = diffDays <= 7 || today >= endDate

  if (!isEligible) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-150 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center text-xl mx-auto font-bold">
          ⏳
        </div>
        <h2 className="text-lg font-bold text-gray-900">Feedback Form Locked</h2>
        <p className="text-sm text-gray-500">
          The feedback form will be unlocked 7 days before your internship completion date.
        </p>
        <p className="text-xs text-gray-400 bg-gray-50 p-2.5 rounded-lg">
          Your Internship End Date: <strong className="text-gray-700">{internship.end_date}</strong>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Internship Feedback</h1>
        <p className="text-sm text-gray-500">Provide your rating and suggestions for your internship at Mahanadi Coalfields Limited.</p>
      </div>

      <FeedbackForm
        internshipId={internship.id}
        existingFeedback={feedback || undefined}
      />
    </div>
  )
}
