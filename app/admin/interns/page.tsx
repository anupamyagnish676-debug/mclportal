import { createClient } from '@/lib/supabase/server'
import InternActions from './InternActions'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import AreaSelector from './AreaSelector'

export const revalidate = 0

export default async function InternsPage({
  searchParams,
}: {
  searchParams: { tab?: string; area?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  const { data: profile } = await supabase.from('profiles').select('role, area').eq('id', user.id).maybeSingle()
  const isAdminGlobal = profile?.area === 'Headquarters'
  const adminArea = profile?.area || ''

  // Fetch areas dynamically from 'areas' table (with fallback)
  let areas: { name: string }[] = []
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

  const activeTab = searchParams.tab === 'completed' ? 'completed' : 'active'
  const selectedArea = isAdminGlobal ? (searchParams.area || '') : adminArea

  let query = supabase
    .from('internships')
    .select(`
      id, start_date, end_date, is_active, certificate_url, certificate_approved, student_id, area,
      student:profiles!internships_student_id_fkey(id, full_name, email, area),
      mentor:profiles!internships_mentor_id_fkey(full_name)
    `)

  if (selectedArea) {
    query = query.eq('area', selectedArea)
  }

  const { data: internships, error } = await query.order('start_date', { ascending: false })

  // Filter interns based on the active tab
  const filteredInternships = (internships || []).filter((i: any) => {
    if (activeTab === 'active') {
      return i.is_active === true
    } else {
      return i.is_active === false
    }
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Interns</h1>
          <p className="text-gray-500 text-sm">
            Manage active and past internships — {selectedArea ? `${selectedArea} Area` : 'All Areas'}
          </p>
        </div>
        {isAdminGlobal && (
          <div className="flex items-center gap-2">
            <AreaSelector selectedArea={selectedArea} areas={areas} />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          Error loading interns: {error.message}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <Link
          href={`/admin/interns?tab=active${selectedArea ? `&area=${selectedArea}` : ''}`}
          className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Active Interns ({ (internships || []).filter(i => i.is_active).length })
        </Link>
        <Link
          href={`/admin/interns?tab=completed${selectedArea ? `&area=${selectedArea}` : ''}`}
          className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'completed'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Completed Interns ({ (internships || []).filter(i => !i.is_active).length })
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {!filteredInternships.length ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {activeTab === 'active' ? 'No active internships found' : 'No completed internships found'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mentor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredInternships.map((i: any) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{i.student?.full_name}</p>
                    <p className="text-gray-400 text-xs">{i.student?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{i.mentor?.full_name || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{i.start_date} → {i.end_date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${i.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {i.is_active ? 'Active' : 'Completed'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <InternActions
                      internshipId={i.id}
                      studentId={i.student_id}
                      studentEmail={i.student?.email}
                      studentName={i.student?.full_name}
                      isActive={i.is_active}
                      hasCertificate={!!i.certificate_url}
                      mentorApproved={!!i.certificate_approved}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
