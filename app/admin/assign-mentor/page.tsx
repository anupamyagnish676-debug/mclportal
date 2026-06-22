import { createClient } from '@/lib/supabase/server'
import AssignMentorForm from './AssignMentorForm'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function AssignMentorPage({
  searchParams,
}: {
  searchParams: { area?: string }
}) {
  const supabase = await createClient()

  // 1. Authenticate and get admin profile
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, area')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') {
    redirect('/login')
  }

  const isAdminGlobal = profile.area === 'Headquarters'
  const adminArea = profile.area || ''
  const selectedArea = isAdminGlobal ? (searchParams.area || '') : adminArea

  // 2. Fetch all areas for Headquarters Admin to filter
  let areas: { name: string }[] = []
  if (isAdminGlobal) {
    try {
      const { data: areasData } = await supabase
        .from('areas')
        .select('name')
        .order('name', { ascending: true })
      if (areasData && areasData.length > 0) {
        areas = areasData
      } else {
        areas = [
          { name: 'Talcher' },
          { name: 'Jagannath' },
          { name: 'Lingaraj' },
          { name: 'Subhadra' },
          { name: 'Headquarters' }
        ]
      }
    } catch (err) {
      areas = [
        { name: 'Talcher' },
        { name: 'Jagannath' },
        { name: 'Lingaraj' },
        { name: 'Subhadra' },
        { name: 'Headquarters' }
      ]
    }
  }

  // 3. Build internships query
  let internshipsQuery = supabase
    .from('internships')
    .select('id, start_date, end_date, is_active, mentor_id, area, student:profiles!internships_student_id_fkey(full_name, email, area), mentor:profiles!internships_mentor_id_fkey(full_name)')
    .order('is_active', { ascending: false })

  if (selectedArea) {
    internshipsQuery = internshipsQuery.eq('area', selectedArea)
  }

  const { data: internships } = await internshipsQuery

  const formattedInternships = (internships || []).map((i: any) => ({
    id: i.id,
    start_date: i.start_date,
    end_date: i.end_date,
    is_active: i.is_active,
    mentor_id: i.mentor_id,
    area: i.area,
    student: Array.isArray(i.student) ? i.student[0] : i.student,
    mentor: Array.isArray(i.mentor) ? i.mentor[0] : i.mentor,
  }))

  // 4. Build mentors query (scoped to the same area as internships to prevent cross-assignment)
  let mentorsQuery = supabase
    .from('profiles')
    .select('id, full_name, email, area')
    .eq('role', 'mentor')

  if (selectedArea) {
    mentorsQuery = mentorsQuery.eq('area', selectedArea)
  }

  const { data: mentors } = await mentorsQuery

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Assign Mentor</h1>
          <p className="text-gray-500 text-sm">
            Assign or change mentor for each intern — {selectedArea ? `${selectedArea} Area` : 'All Areas'}
          </p>
        </div>
      </div>
      <AssignMentorForm 
        internships={formattedInternships} 
        mentors={mentors || []} 
        isAdminGlobal={isAdminGlobal}
        selectedArea={selectedArea}
        areas={areas}
      />
    </div>
  )
}
