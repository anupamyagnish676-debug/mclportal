import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Mahanadi Coalfields Limited — Internship Management</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <a href="/admin/applications" className="flex items-center gap-3 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="text-xl">📋</span>
            <div><p className="text-sm font-medium text-gray-900">Review Applications</p><p className="text-xs text-gray-400">Approve or reject LoR submissions</p></div>
          </a>
          <a href="/admin/create-user" className="flex items-center gap-3 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="text-xl">➕</span>
            <div><p className="text-sm font-medium text-gray-900">Create User</p><p className="text-xs text-gray-400">Add mentor, employee, or admin</p></div>
          </a>
          <a href="/admin/interns" className="flex items-center gap-3 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="text-xl">👥</span>
            <div><p className="text-sm font-medium text-gray-900">Manage Interns</p><p className="text-xs text-gray-400">Control access, issue certificates</p></div>
          </a>
        </div>
      </div>
    </div>
  )
}
