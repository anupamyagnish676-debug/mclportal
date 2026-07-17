import { createClient } from '@/lib/supabase/server'
import AdminDashboardClient from './AdminDashboardClient'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Users, FileText, CheckCircle2, UserPlus, Building2,
  FolderInput, Link as LinkIcon, GraduationCap, FileCheck,
  Clock, Bell, Mail, MessageSquare, Settings
} from 'lucide-react'

export const revalidate = 0

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
    { label: 'Total Students',        value: totalStudents, color: 'bg-blue-50/50 text-blue-600 border border-blue-100/50',     icon: Users },
    { label: 'Pending Applications',  value: pendingApps,   color: 'bg-amber-50/50 text-amber-600 border border-amber-100/50', icon: FileText },
    { label: 'Active Internships',    value: activeInterns, color: 'bg-emerald-50/50 text-emerald-600 border border-emerald-100/50',   icon: CheckCircle2 },
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

  // Feature hub cards
  const featureCards = [
    {
      label: 'Applications',
      desc: 'Review & approve LoR requests',
      href: '/admin/applications',
      icon: FileText,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50 hover:bg-blue-100/80',
      text: 'text-blue-700',
    },
    {
      label: 'Interns',
      desc: 'Manage active & completed interns',
      href: '/admin/interns',
      icon: Users,
      color: 'from-indigo-500 to-indigo-600',
      bg: 'bg-indigo-50 hover:bg-indigo-100/80',
      text: 'text-indigo-700',
    },
    {
      label: 'Departments',
      desc: 'Setup wings & training departments',
      href: '/admin/departments',
      icon: Building2,
      color: 'from-amber-500 to-amber-600',
      bg: 'bg-amber-50 hover:bg-amber-100/80',
      text: 'text-amber-700',
    },
    {
      label: 'Bulk Onboard',
      desc: 'Onboard multiple interns at once',
      href: '/admin/bulk-onboarding',
      icon: FolderInput,
      color: 'from-teal-500 to-teal-600',
      bg: 'bg-teal-50 hover:bg-teal-100/80',
      text: 'text-teal-700',
    },
    {
      label: 'Assign Mentor',
      desc: 'Link mentors to student interns',
      href: '/admin/assign-mentor',
      icon: LinkIcon,
      color: 'from-cyan-500 to-cyan-600',
      bg: 'bg-cyan-50 hover:bg-cyan-100/80',
      text: 'text-cyan-700',
    },
    {
      label: 'Issue Certificate',
      desc: 'Generate & issue completion certs',
      href: '/admin/issue-certificate',
      icon: GraduationCap,
      color: 'from-violet-500 to-violet-600',
      bg: 'bg-violet-50 hover:bg-violet-100/80',
      text: 'text-violet-700',
    },
    {
      label: 'Verify Documents',
      desc: 'Review & verify uploaded docs',
      href: '/admin/documents',
      icon: FileCheck,
      color: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50 hover:bg-emerald-100/80',
      text: 'text-emerald-700',
    },
    {
      label: 'Confirm Extensions',
      desc: 'Approve internship extension requests',
      href: '/admin/extension-requests',
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      bg: 'bg-orange-50 hover:bg-orange-100/80',
      text: 'text-orange-700',
    },
    {
      label: 'Notice Board',
      desc: 'Post & manage announcements',
      href: '/admin/notices',
      icon: Bell,
      color: 'from-rose-500 to-rose-600',
      bg: 'bg-rose-50 hover:bg-rose-100/80',
      text: 'text-rose-700',
    },
    {
      label: 'Grievances',
      desc: 'View & resolve intern grievances',
      href: '/admin/grievances',
      icon: Mail,
      color: 'from-pink-500 to-pink-600',
      bg: 'bg-pink-50 hover:bg-pink-100/80',
      text: 'text-pink-700',
    },
    {
      label: 'Feedback Reports',
      desc: 'Read intern satisfaction reports',
      href: '/admin/feedback',
      icon: MessageSquare,
      color: 'from-purple-500 to-purple-600',
      bg: 'bg-purple-50 hover:bg-purple-100/80',
      text: 'text-purple-700',
    },
    {
      label: 'Create User',
      desc: 'Add student, mentor or employee',
      href: '/admin/create-user',
      icon: UserPlus,
      color: 'from-green-500 to-green-600',
      bg: 'bg-green-50 hover:bg-green-100/80',
      text: 'text-green-700',
    },
    {
      label: 'Settings',
      desc: 'Manage your account & preferences',
      href: '/admin/settings',
      icon: Settings,
      color: 'from-slate-500 to-slate-600',
      bg: 'bg-slate-50 hover:bg-slate-100/80',
      text: 'text-slate-700',
    },
  ]

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
          <div key={s.label} className="glass-card rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300">
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

      {/* Feature Hub */}
      <div>
        <h2 className="font-bold text-gray-800 text-sm mb-4">All Features</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {featureCards.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className={`group flex flex-col gap-3 p-4 rounded-xl border border-gray-100 ${card.bg} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-transparent`}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className={`text-sm font-semibold ${card.text}`}>{card.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Department Analytics Chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 className="font-bold text-gray-800 text-sm mb-4">
          Active Interns by Wing {selectedArea ? `(${selectedArea} Area)` : '(All Areas)'}
        </h2>
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
  )
}
