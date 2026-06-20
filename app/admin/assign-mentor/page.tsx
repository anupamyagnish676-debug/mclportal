import { createClient } from '@/lib/supabase/server'
import AssignMentorForm from './AssignMentorForm'

export const revalidate = 0

export default async function AssignMentorPage() {
  const supabase = await createClient()

  const { data: internships } = await supabase
    .from('internships')
    .select('id, start_date, end_date, is_active, mentor_id, student:profiles!internships_student_id_fkey(full_name, email), mentor:profiles!internships_mentor_id_fkey(full_name)')
    .order('is_active', { ascending: false })

  const formattedInternships = (internships || []).map((i: any) => ({
    id: i.id,
    start_date: i.start_date,
    end_date: i.end_date,
    is_active: i.is_active,
    mentor_id: i.mentor_id,
    student: Array.isArray(i.student) ? i.student[0] : i.student,
    mentor: Array.isArray(i.mentor) ? i.mentor[0] : i.mentor,
  }))

  const { data: mentors } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'mentor')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Assign Mentor</h1>
      <p className="text-gray-500 text-sm mb-8">Assign or change mentor for each intern</p>
      <AssignMentorForm internships={formattedInternships} mentors={mentors || []} />
    </div>
  )
}
