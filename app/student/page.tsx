import { createClient } from '@/lib/supabase/server'
import ProjectReportUpload from './ProjectReportUpload'
import Link from 'next/link'
import {
  Calendar, ClipboardList, CheckCircle2, BookOpen, Mail,
  FolderOpen, FileCheck, Clock, Bell, DollarSign,
  MessageSquare, GraduationCap, Settings
} from 'lucide-react'

export const revalidate = 0

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: internship, error } = await supabase
    .from('internships')
    .select('*, mentor:profiles!internships_mentor_id_fkey(full_name, email)')
    .eq('student_id', user!.id)
    .maybeSingle()

  let presentDays = 0, totalAssignments = 0, submitted = 0
  if (internship) {
    const [p, a, s] = await Promise.all([
      supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('internship_id', internship.id).eq('status', 'present'),
      supabase.from('assignments').select('*', { count: 'exact', head: true }).eq('internship_id', internship.id),
      supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('student_id', user!.id),
    ])
    presentDays = p.count ?? 0
    totalAssignments = a.count ?? 0
    submitted = s.count ?? 0
  }

  const featureCards = [
    {
      label: 'Attendance',
      desc: 'View your attendance record',
      href: '/student/attendance',
      icon: Calendar,
      color: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50 hover:bg-emerald-100/80',
      text: 'text-emerald-700',
    },
    {
      label: 'Daily Logbook',
      desc: 'Log your daily work activities',
      href: '/student/logbook',
      icon: BookOpen,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50 hover:bg-blue-100/80',
      text: 'text-blue-700',
    },
    {
      label: 'Leave Apply',
      desc: 'Submit a leave application',
      href: '/student/leaves',
      icon: Mail,
      color: 'from-amber-500 to-amber-600',
      bg: 'bg-amber-50 hover:bg-amber-100/80',
      text: 'text-amber-700',
    },
    {
      label: 'Assignments',
      desc: 'View & submit your assignments',
      href: '/student/assignments',
      icon: ClipboardList,
      color: 'from-indigo-500 to-indigo-600',
      bg: 'bg-indigo-50 hover:bg-indigo-100/80',
      text: 'text-indigo-700',
    },
    {
      label: 'Materials',
      desc: 'Download study resources',
      href: '/student/materials',
      icon: FolderOpen,
      color: 'from-teal-500 to-teal-600',
      bg: 'bg-teal-50 hover:bg-teal-100/80',
      text: 'text-teal-700',
    },
    {
      label: 'Upload Documents',
      desc: 'Submit required identity documents',
      href: '/student/documents',
      icon: FileCheck,
      color: 'from-cyan-500 to-cyan-600',
      bg: 'bg-cyan-50 hover:bg-cyan-100/80',
      text: 'text-cyan-700',
    },
    {
      label: 'Extension Apply',
      desc: 'Request an internship extension',
      href: '/student/extension',
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      bg: 'bg-orange-50 hover:bg-orange-100/80',
      text: 'text-orange-700',
    },
    {
      label: 'Notice Board',
      desc: 'View announcements from admin',
      href: '/student/notices',
      icon: Bell,
      color: 'from-rose-500 to-rose-600',
      bg: 'bg-rose-50 hover:bg-rose-100/80',
      text: 'text-rose-700',
    },
    {
      label: 'My Stipend',
      desc: 'Track stipend payment status',
      href: '/student/stipend',
      icon: DollarSign,
      color: 'from-green-500 to-green-600',
      bg: 'bg-green-50 hover:bg-green-100/80',
      text: 'text-green-700',
    },
    {
      label: 'Feedback',
      desc: 'Share your internship feedback',
      href: '/student/feedback',
      icon: MessageSquare,
      color: 'from-purple-500 to-purple-600',
      bg: 'bg-purple-50 hover:bg-purple-100/80',
      text: 'text-purple-700',
    },
    {
      label: 'Grievance',
      desc: 'Submit a formal grievance',
      href: '/student/grievance',
      icon: Mail,
      color: 'from-pink-500 to-pink-600',
      bg: 'bg-pink-50 hover:bg-pink-100/80',
      text: 'text-pink-700',
    },
    {
      label: 'Certificate',
      desc: 'Download your completion certificate',
      href: '/student/certificate',
      icon: GraduationCap,
      color: 'from-violet-500 to-violet-600',
      bg: 'bg-violet-50 hover:bg-violet-100/80',
      text: 'text-violet-700',
    },
    {
      label: 'Settings',
      desc: 'Manage your account preferences',
      href: '/student/settings',
      icon: Settings,
      color: 'from-slate-500 to-slate-600',
      bg: 'bg-slate-50 hover:bg-slate-100/80',
      text: 'text-slate-700',
    },
  ]

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Student Dashboard</h1>
        <p className="text-gray-500 text-sm">Welcome to your MCL internship portal</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error.message}</div>
      )}

      {internship ? (
        <div className="grid md:grid-cols-5 gap-6">
          {/* Details & Report Upload (Left Column) */}
          <div className="md:col-span-3 space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Internship Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-400 text-xs">Mentor</p><p className="font-semibold text-gray-800 mt-0.5">{internship.mentor?.full_name || 'Not assigned yet'}</p></div>
                <div><p className="text-gray-400 text-xs">Period</p><p className="font-semibold text-gray-800 mt-0.5">{internship.start_date} → {internship.end_date}</p></div>
                <div><p className="text-gray-400 text-xs">Status</p>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${internship.is_active ? 'bg-green-150 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {internship.is_active ? 'Active' : 'Completed'}
                  </span>
                </div>
                {internship.certificate_url && (
                  <div><p className="text-gray-400 text-xs">Certificate</p>
                    <a href={internship.certificate_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-semibold block mt-1">Download Certificate →</a>
                  </div>
                )}
              </div>
            </div>

            <ProjectReportUpload
              internshipId={internship.id}
              currentReportUrl={internship.project_report_url}
              currentProjectTitle={internship.project_title}
            />
          </div>

          {/* Stats Overview (Right Column) */}
          <div className="md:col-span-2 space-y-4">
            {[
              { label: 'Days Present', value: presentDays, icon: Calendar, color: 'text-green-600 bg-green-50/50 border border-green-100/50' },
              { label: 'Assignments',  value: totalAssignments, icon: ClipboardList, color: 'text-blue-600 bg-blue-50/50 border border-blue-100/50' },
              { label: 'Submitted',    value: submitted, icon: CheckCircle2, color: 'text-purple-600 bg-purple-50/50 border border-purple-100/50' },
            ].map(s => (
              <div key={s.label} className="glass-card rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300">
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
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 shadow-sm">
          No internship record found. Please contact your training office.
        </div>
      )}

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
    </div>
  )
}
