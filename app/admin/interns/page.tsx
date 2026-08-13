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

  const activeTab = searchParams.tab === 'completed' ? 'completed' : searchParams.tab === 'transferred' ? 'transferred' : 'active'
  const selectedArea = isAdminGlobal ? (searchParams.area || '') : adminArea

  let query = supabase
    .from('internships')
    .select(`
      id, start_date, end_date, is_active, certificate_url, certificate_approved, student_id, area, serial_no,
      internship_type, stipend_amount, stipend_frequency,
      student:profiles!internships_student_id_fkey(id, full_name, email, area, wing),
      mentor:profiles!internships_mentor_id_fkey(full_name)
    `)

  if (selectedArea) {
    query = query.ilike('area', selectedArea)
  }

  const { data: internships, error } = await query.order('start_date', { ascending: false })

  // Fetch outward transfers (applications referred or forwarded by this admin/area)
  let transfersQuery = supabase
    .from('applications')
    .select(`
      id, status, applied_at, lor_url, student_id, student_name, student_email, employee_code, roll_no, university,
      student:profiles!applications_student_id_fkey(full_name, email, area, wing),
      referrer:profiles!applications_referred_by_fkey(full_name, area)
    `)
    .not('referred_by', 'is', null)

  if (!isAdminGlobal) {
    transfersQuery = transfersQuery.eq('referred_by', user.id)
  }

  const { data: transferredOutApps } = await transfersQuery.order('applied_at', { ascending: false })

  // Filter interns based on the active tab
  const filteredInternships = (internships || []).filter((i: any) => {
    if (activeTab === 'active') {
      return i.is_active === true || (selectedArea && i.student?.area?.trim().toLowerCase() === selectedArea.trim().toLowerCase())
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
            Manage active, past, and transferred internships — {selectedArea ? `${selectedArea} Area` : 'All Areas'}
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
        <Link
          href={`/admin/interns?tab=transferred${selectedArea ? `&area=${selectedArea}` : ''}`}
          className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'transferred'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Transferred Out ({ (transferredOutApps || []).length })
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        {activeTab === 'transferred' ? (
          !transferredOutApps?.length ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No outward area transfer records found for your area.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Transferred To</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">LoR Document</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Forwarded Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transferredOutApps.map((app: any) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{app.student?.full_name || app.student_name}</p>
                      <p className="text-gray-400 text-xs">{app.student?.email || app.student_email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{app.student?.wing || 'Technical'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        📍 {app.student?.area || 'Target Area'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {app.lor_url ? (
                        <a
                          href={app.lor_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 underline"
                        >
                          📄 View LoR Document
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">No LoR attached</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(app.applied_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        app.status === 'pending_area'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : app.status === 'approved'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {app.status === 'pending_area' ? '⏳ Pending Target Area Approval' : app.status === 'approved' ? '✓ Approved & Enrolled' : app.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : !filteredInternships.length ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {activeTab === 'active' ? 'No active internships found' : 'No completed internships found'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Serial No</th>
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
                  <td className="px-4 py-3 font-medium text-gray-900">{i.serial_no || i.id.slice(0, 8)}</td>
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
                      studentName={i.student?.full_name || 'Intern'}
                      isActive={i.is_active}
                      initialType={i.internship_type || 'unpaid'}
                      initialAmount={i.stipend_amount || 0}
                      initialFrequency={i.stipend_frequency || 'monthly'}
                      wing={i.student?.wing}
                      area={i.area || i.student?.area}
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
