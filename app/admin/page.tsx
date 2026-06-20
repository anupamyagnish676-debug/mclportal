import { createClient } from '@/lib/supabase/server'
import AdminDashboardClient from './AdminDashboardClient'

export const revalidate = 0 // fetch fresh statistics on every request

export default async function AdminDashboard() {
  const supabase = await createClient()

  // 1. Fetch counts
  const [{ count: totalStudents }, { count: pendingApps }, { count: activeInterns }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('internships').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ])

  const stats = [
    { label: 'Total Students',        value: totalStudents ?? 0, color: 'bg-blue-50 text-blue-700',     icon: '👥' },
    { label: 'Pending Applications',  value: pendingApps ?? 0,   color: 'bg-yellow-50 text-yellow-700', icon: '📋' },
    { label: 'Active Internships',    value: activeInterns ?? 0, color: 'bg-green-50 text-green-700',   icon: '✅' },
  ]

  // 2. Fetch completed interns for CSV Export
  const { data: completedInterns } = await supabase
    .from('internships')
    .select('serial_no, start_date, end_date, student:profiles!internships_student_id_fkey(full_name, email, roll_no, university, wing)')
    .eq('is_active', false)

  // 3. Fetch active internships with attendance to group by wing/department & find low attendance alerts
  const { data: activeInternshipsData } = await supabase
    .from('internships')
    .select('id, serial_no, student:profiles!internships_student_id_fkey(full_name, email, wing), attendance(status)')
    .eq('is_active', true)

  // Calculate wing counts
  const wingCounts: Record<string, number> = {}
  activeInternshipsData?.forEach((i: any) => {
    const w = i.student?.wing || 'Unassigned / General'
    wingCounts[w] = (wingCounts[w] || 0) + 1
  })
  const chartData = Object.entries(wingCounts).map(([name, count]) => ({ name, count }))
  const maxCount = Math.max(...chartData.map(d => d.count), 1)

  // Calculate low attendance alerts (< 75%)
  const lowAttendanceAlerts = (activeInternshipsData || [])
    .map((i: any) => {
      const total = i.attendance?.length || 0
      const present = i.attendance?.filter((a: any) => a.status === 'present').length || 0
      const percent = total > 0 ? Math.round((present / total) * 100) : 100
      return {
        id: i.id,
        serial_no: i.serial_no,
        name: i.student?.full_name || 'Unknown',
        email: i.student?.email || 'N/A',
        percent,
        total,
        present
      }
    })
    .filter(x => x.total > 0 && x.percent < 75)

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">Mahanadi Coalfields Limited — Internship Management</p>
        </div>
        <div className="flex items-center gap-2">
          <AdminDashboardClient completedInterns={completedInterns || []} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-2xl font-bold text-gray-900 leading-none">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Left Column: Quick Actions & Charts */}
        <div className="md:col-span-3 space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 text-sm mb-4">Quick actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <a href="/admin/applications" className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="text-lg">📋</span>
                <div>
                  <p className="text-xs font-semibold text-gray-900">Review Applications</p>
                  <p className="text-[10px] text-gray-400">Approve or reject LoR requests</p>
                </div>
              </a>
              <a href="/admin/create-user" className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="text-lg">➕</span>
                <div>
                  <p className="text-xs font-semibold text-gray-900">Create User</p>
                  <p className="text-[10px] text-gray-400">Add student, mentor, employee</p>
                </div>
              </a>
              <a href="/admin/interns" className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="text-lg">👥</span>
                <div>
                  <p className="text-xs font-semibold text-gray-900">Manage Interns</p>
                  <p className="text-[10px] text-gray-400">Control active & completed list</p>
                </div>
              </a>
              <a href="/admin/departments" className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="text-lg">🏢</span>
                <div>
                  <p className="text-xs font-semibold text-gray-900">Departments Manager</p>
                  <p className="text-[10px] text-gray-400">Setup wings & training departments</p>
                </div>
              </a>
            </div>
          </div>

          {/* Department Analytics Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 text-sm mb-4">Active Interns by Wing</h2>
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

        {/* Right Column: Low Attendance Alerts */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 text-sm">Low Attendance Alerts</h2>
              <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                ⚠️ Critical
              </span>
            </div>
            
            <p className="text-[11px] text-gray-400 mb-4 leading-normal">
              Active interns with attendance percentages falling below the required 75% training threshold.
            </p>

            <div className="flex-1 overflow-y-auto space-y-3">
              {!lowAttendanceAlerts.length ? (
                <div className="h-full flex flex-col items-center justify-center py-12 text-center text-gray-400 text-xs space-y-2">
                  <span className="text-2xl">🎉</span>
                  <p>All active interns have satisfactory attendance records!</p>
                </div>
              ) : (
                lowAttendanceAlerts.map(alert => (
                  <div key={alert.id} className="p-3 border border-red-100 rounded-xl bg-red-50/20 space-y-1.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{alert.name}</p>
                        <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          Serial: {alert.serial_no || 'N/A'}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                        {alert.percent}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>Email: {alert.email}</span>
                      <span>({alert.present}/{alert.total} days)</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
