import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AreaSelector from '../interns/AreaSelector'

export const revalidate = 0

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: { area?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, area')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/login')

  const isAdminGlobal = profile.area === 'Headquarters'
  const adminArea = profile.area || ''
  const selectedArea = isAdminGlobal ? (searchParams.area || '') : adminArea

  // Fetch areas
  let areas: { name: string }[] = []
  try {
    const { data: areasData } = await supabase
      .from('areas')
      .select('name')
      .order('name', { ascending: true })
    if (areasData && areasData.length > 0) {
      areas = areasData
    } else {
      areas = [{ name: 'Talcher' }, { name: 'Jagannath' }, { name: 'Lingaraj' }, { name: 'Subhadra' }, { name: 'Headquarters' }]
    }
  } catch (err) {
    areas = [{ name: 'Talcher' }, { name: 'Jagannath' }, { name: 'Lingaraj' }, { name: 'Subhadra' }, { name: 'Headquarters' }]
  }

  // Fetch all feedback
  let query = supabase
    .from('internship_feedback')
    .select(`
      id,
      student_rating,
      student_comments,
      mentor_rating,
      mentor_comments,
      submitted_by_student_at,
      submitted_by_mentor_at,
      internship:internships(
        area,
        student:profiles!internships_student_id_fkey(full_name, university, wing),
        mentor:profiles!internships_mentor_id_fkey(full_name)
      )
    `)

  const { data: feedback, error } = await query

  // Filter feedback by area
  const filteredFeedback = (feedback || []).filter((fb: any) => {
    if (!fb.internship) return false
    if (selectedArea) {
      return fb.internship.area === selectedArea
    }
    return true
  })

  // Summary Metrics
  const totalReceived = filteredFeedback.length
  
  const studentRatings = filteredFeedback.filter(f => f.student_rating !== null).map(f => f.student_rating as number)
  const mentorRatings = filteredFeedback.filter(f => f.mentor_rating !== null).map(f => f.mentor_rating as number)

  const avgStudent = studentRatings.length > 0 
    ? (studentRatings.reduce((a, b) => a + b, 0) / studentRatings.length).toFixed(1)
    : 'N/A'

  const avgMentor = mentorRatings.length > 0
    ? (mentorRatings.reduce((a, b) => a + b, 0) / mentorRatings.length).toFixed(1)
    : 'N/A'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Internship Feedback Reports</h1>
          <p className="text-sm text-gray-500">
            View evaluations and program feedback submitted by students and mentors.
          </p>
        </div>
        {isAdminGlobal && (
          <div className="flex items-center gap-2">
            <AreaSelector selectedArea={selectedArea} areas={areas} />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100">
          Error loading feedback: {error.message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-1">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Feedbacks</p>
          <p className="text-3xl font-extrabold text-gray-900">{totalReceived}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-1">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Avg Student Rating</p>
          <p className="text-3xl font-extrabold text-[#166534]">{avgStudent} <span className="text-sm text-gray-400">/ 5</span></p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-1">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Avg Mentor Rating</p>
          <p className="text-3xl font-extrabold text-amber-600">{avgMentor} <span className="text-sm text-gray-400">/ 5</span></p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wider">
                <th className="p-4">Intern Name</th>
                <th className="p-4">Area / Dept</th>
                <th className="p-4 text-center">Student Rating</th>
                <th className="p-4">Student Comments</th>
                <th className="p-4 text-center">Mentor Rating</th>
                <th className="p-4">Mentor Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredFeedback.map((fb: any) => {
                const sName = fb.internship?.student?.full_name || 'N/A'
                const sArea = fb.internship?.area || 'N/A'
                const sWing = fb.internship?.student?.wing || 'N/A'

                return (
                  <tr key={fb.id} className="hover:bg-gray-50/50">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{sName}</div>
                      <div className="text-[10px] text-gray-400">{fb.internship?.student?.university}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-medium text-gray-700">{sArea} Area</div>
                      <div className="text-[10px] text-gray-400">{sWing}</div>
                    </td>
                    <td className="p-4 text-center">
                      {fb.student_rating ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg text-xs">
                          ★ {fb.student_rating}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 italic">No rating</span>
                      )}
                    </td>
                    <td className="p-4 max-w-xs">
                      <p className="text-xs text-gray-600 line-clamp-3 italic">
                        {fb.student_comments ? `"${fb.student_comments}"` : '—'}
                      </p>
                    </td>
                    <td className="p-4 text-center">
                      {fb.mentor_rating ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg text-xs">
                          ★ {fb.mentor_rating}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 italic">No rating</span>
                      )}
                    </td>
                    <td className="p-4 max-w-xs">
                      <p className="text-xs text-gray-600 line-clamp-3 italic">
                        {fb.mentor_comments ? `"${fb.mentor_comments}"` : '—'}
                      </p>
                    </td>
                  </tr>
                )
              })}
              {filteredFeedback.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 italic">
                    No feedback forms submitted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
