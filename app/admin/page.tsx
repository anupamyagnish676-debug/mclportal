import { createClient } from '@/lib/supabase/server'
import AdminDashboardClient from './AdminDashboardClient'
import { redirect } from 'next/navigation'
import { Users, FileText, CheckCircle2, UserPlus, Building2 } from 'lucide-react'

export const revalidate = 0 // fetch fresh statistics on every request

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { area?: string }
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

  // Current active area filter (only applicable for Global Admins)
  const selectedArea = isAdminGlobal ? (searchParams.area || '') : adminArea

  let totalStudents = 0
  let pendingApps = 0
  let activeInterns = 0

  // 1. Fetch scoped counts
  if (isAdminGlobal) {
    const studentQuery = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student')
    const internQuery = supabase.from('internships').select('*', { count: 'exact', head: true }).eq('is_active', true)

    if (selectedArea) {
      studentQuery.eq('area', selectedArea)
      internQuery.eq('area', selectedArea)
    }

    const [ts, pa, ai] = await Promise.all([
      studentQuery,
      supabase.from('applications').select('*', { count: 'exact', head: true }).in('status', ['pending_hq', 'pending']),
      internQuery
    ])

    totalStudents = ts.count ?? 0
    activeInterns = ai.count ?? 0

    if (selectedArea) {
      const { data: hqApps } = await supabase
        .from('applications')
        .select('id, referrer:profiles!applications_referred_by_fkey(area)')
        .in('status', ['pending_hq', 'pending'])
      pendingApps = (hqApps || []).filter((app: any) => app.referrer?.area === selectedArea).length
    } else {
      pendingApps = pa.count ?? 0
    }
  } else {
    // Area Admin scope
    const [ts, ai] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('area', adminArea),
      supabase.from('internships').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('area', adminArea),
    ])
    totalStudents = ts.count ?? 0
    activeInterns = ai.count ?? 0

    const { data: areaApps } = await supabase
      .from('applications')
      .select('id, referrer:profiles!applications_referred_by_fkey(area)')
      .eq('status', 'pending_area')
    pendingApps = (areaApps || []).filter((app: any) => app.referrer?.area === adminArea).length
  }

  const stats = [
    { label: 'Total Students',        value: totalStudents, color: 'bg-blue-50 text-blue-700',     icon: Users },
    { label: 'Pending Applications',  value: pendingApps,   color: 'bg-yellow-50 text-yellow-700', icon: FileText },
    { label: 'Active Internships',    value: activeInterns, color: 'bg-green-50 text-green-700',   icon: CheckCircle2 },
  ]

  // 2. Fetch completed interns for CSV Export
  const completedQuery = supabase
    .from('internships')
    .select('serial_no, start_date, end_date, student:profiles!internships_student_id_fkey(full_name, email, roll_no, university, wing, area)')
    .eq('is_active', false)

  if (selectedArea) {
    completedQuery.eq('area', selectedArea)
  }
  const { data: completedInterns } = await completedQuery

  // 3. Fetch active internships to group by wing/department
  const activeQuery = supabase
    .from('internships')
    .select('id, serial_no, area, student:profiles!internships_student_id_fkey(full_name, email, wing)')
    .eq('is_active', true)

  if (selectedArea) {
    activeQuery.eq('area', selectedArea)
  }
  const { data: activeInternshipsData } = await activeQuery

  // Calculate wing counts
  const wingCounts: Record<string, number> = {}
  activeInternshipsData?.forEach((i: any) => {
    const w = i.student?.wing || 'Unassigned / General'
    wingCounts[w] = (wingCounts[w] || 0) + 1
  })
  const chartData = Object.entries(wingCounts).map(([name, count]) => ({ name, count }))
  const maxCount = Math.max(...chartData.map(d => d.count), 1)

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Mahanadi Coalfields Limited — {!isAdminGlobal && selectedArea ? `${selectedArea} Area` : 'Headquarters'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminDashboardClient 
            completedInterns={completedInterns || []} 
            isAdminGlobal={isAdminGlobal} 
            selectedArea={searchParams.area || ''} 
            areas={areas}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 leading-none">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col">
          <h2 className="font-bold text-gray-800 text-sm mb-4">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 flex-1">
            <a href="/admin/applications" className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
              <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-900">Review Applications</p>
                <p className="text-[10px] text-gray-400">Approve or reject LoR requests</p>
              </div>
            </a>
            <a href="/admin/create-user" className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
              <UserPlus className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-900">Create User</p>
                <p className="text-[10px] text-gray-400">Add student, mentor, employee</p>
              </div>
            </a>
            <a href="/admin/interns" className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
              <Users className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-900">Manage Interns</p>
                <p className="text-[10px] text-gray-400">Control active & completed list</p>
              </div>
            </a>
            <a href="/admin/departments" className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
              <Building2 className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-900">Departments Manager</p>
                <p className="text-[10px] text-gray-400">Setup wings & training departments</p>
              </div>
            </a>
            {isAdminGlobal && (
              <a href="/admin/areas" className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                <Building2 className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-900">Areas Manager</p>
                  <p className="text-[10px] text-gray-400">Manage training office locations</p>
                </div>
              </a>
            )}
          </div>
        </div>

        {/* Department Analytics Chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col">
          <h2 className="font-bold text-gray-800 text-sm mb-4">
            Active Interns by Wing {selectedArea ? `(${selectedArea} Area)` : '(All Areas)'}
          </h2>
          <div className="flex-1">
            {!chartData.length ? (
              <p className="text-center py-8 text-gray-400 text-xs">No active internships registered in any wings.</p>
            ) : (
              <div className="space-y-4">
                {chartData.map((d, i) => {
                  const percentage = Math.round((d.count / maxCount) * 100)
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                        <span>{d.name}</span>
                        <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{d.count} active</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
