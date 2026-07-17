import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Calendar, ClipboardList, FolderOpen, FileText,
  Clock, Bell, MessageSquare, GraduationCap, Settings
} from 'lucide-react'

export default async function MentorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: internships, error } = await supabase
    .from('internships')
    .select(`id, start_date, end_date, is_active, student:profiles!internships_student_id_fkey(full_name, email)`)
    .eq('mentor_id', user!.id)

  const activeCount = internships?.filter((i: any) => i.is_active).length ?? 0
  const totalCount = internships?.length ?? 0

  const featureCards = [
    {
      label: 'Attendance',
      desc: 'Mark & track intern attendance daily',
      href: '/mentor/attendance',
      icon: Calendar,
      color: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50 hover:bg-emerald-100/80',
      text: 'text-emerald-700',
    },
    {
      label: 'Assignments',
      desc: 'Create & manage intern assignments',
      href: '/mentor/assignments',
      icon: ClipboardList,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50 hover:bg-blue-100/80',
      text: 'text-blue-700',
    },
    {
      label: 'Materials',
      desc: 'Upload study resources for interns',
      href: '/mentor/materials',
      icon: FolderOpen,
      color: 'from-amber-500 to-amber-600',
      bg: 'bg-amber-50 hover:bg-amber-100/80',
      text: 'text-amber-700',
    },
    {
      label: 'Intern Reviews',
      desc: 'Submit performance evaluations',
      href: '/mentor/intern-reviews',
      icon: FileText,
      color: 'from-indigo-500 to-indigo-600',
      bg: 'bg-indigo-50 hover:bg-indigo-100/80',
      text: 'text-indigo-700',
    },
    {
      label: 'Extensions',
      desc: 'Review internship extension requests',
      href: '/mentor/extension-requests',
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      bg: 'bg-orange-50 hover:bg-orange-100/80',
      text: 'text-orange-700',
    },
    {
      label: 'Notice Board',
      desc: 'View & share announcements',
      href: '/mentor/notices',
      icon: Bell,
      color: 'from-rose-500 to-rose-600',
      bg: 'bg-rose-50 hover:bg-rose-100/80',
      text: 'text-rose-700',
    },
    {
      label: 'Intern Feedback',
      desc: 'Read feedback submitted by interns',
      href: '/mentor/intern-feedback',
      icon: MessageSquare,
      color: 'from-purple-500 to-purple-600',
      bg: 'bg-purple-50 hover:bg-purple-100/80',
      text: 'text-purple-700',
    },
    {
      label: 'Approve Certificate',
      desc: 'Approve completion certificates',
      href: '/mentor/approve-certificate',
      icon: GraduationCap,
      color: 'from-teal-500 to-teal-600',
      bg: 'bg-teal-50 hover:bg-teal-100/80',
      text: 'text-teal-700',
    },
    {
      label: 'Settings',
      desc: 'Manage your account & preferences',
      href: '/mentor/settings',
      icon: Settings,
      color: 'from-slate-500 to-slate-600',
      bg: 'bg-slate-50 hover:bg-slate-100/80',
      text: 'text-slate-700',
    },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Mentor Dashboard</h1>
        <p className="text-gray-500 text-sm">Manage your assigned interns and resources</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:scale-[1.01] transition-all duration-300">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50/50 text-emerald-600 border border-emerald-100/50">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{activeCount}</p>
            <p className="text-xs text-gray-500 mt-1">Active Interns</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:scale-[1.01] transition-all duration-300">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50/50 text-blue-600 border border-blue-100/50">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{totalCount}</p>
            <p className="text-xs text-gray-500 mt-1">Total Assigned</p>
          </div>
        </div>
      </div>

      {/* Feature Hub */}
      <div>
        <h2 className="font-bold text-gray-800 text-sm mb-4">All Features</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

      {/* Interns list */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-3">Your Interns</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            Error loading interns: {error.message}
          </div>
        )}

        <div className="grid gap-3">
          {!internships?.length ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
              No interns assigned yet. Ask admin to assign you as mentor for a student.
            </div>
          ) : internships.map((i: any) => (
            <div key={i.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
                  {i.student?.full_name?.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{i.student?.full_name}</p>
                  <p className="text-xs text-gray-400">{i.student?.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{i.start_date} → {i.end_date}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${i.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {i.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
