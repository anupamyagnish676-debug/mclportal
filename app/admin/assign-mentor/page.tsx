import { createClient } from '@/lib/supabase/server'
import AssignMentorForm from './AssignMentorForm'

export default async function AssignMentorPage() {
  const supabase = await createClient()

  const { data: internships } = await supabase
    .from('internships')
    .select('id, start_date, end_date, is_active, mentor_id, student:profiles!internships_student_id_fkey(full_name, email), mentor:profiles!internships_mentor_id_fkey(full_name)')
    .order('is_active', { ascending: false })

  const { data: mentors } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'mentor')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Assign Mentor</h1>
      <p className="text-gray-500 text-sm mb-8">Assign or change mentor for each intern</p>
      <AssignMentorForm internships={internships || []} mentors={mentors || []} />
    </div>
  )
}
