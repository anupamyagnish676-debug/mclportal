'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'

import { 
  Home, 
  FileText, 
  Users, 
  Building2, 
  FolderInput, 
  Link as LinkIcon, 
  GraduationCap, 
  UserPlus, 
  Settings,
  Calendar,
  ClipboardList,
  BookOpen,
  Mail,
  FolderOpen,
  MessageSquare,
  Clock,
  DollarSign,
  FileCheck,
  Bell,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

type NavItem = { label: string; href: string; icon: React.ComponentType<any> }

const navByRole: Record<string, NavItem[]> = {
  admin: [
    { label: 'Dashboard',         href: '/admin',                  icon: Home },
    { label: 'Applications',      href: '/admin/applications',     icon: FileText },
    { label: 'Interns',           href: '/admin/interns',          icon: Users },
    { label: 'Departments',       href: '/admin/departments',      icon: Building2 },
    { label: 'Bulk Onboard',      href: '/admin/bulk-onboarding',  icon: FolderInput },
    { label: 'Assign Mentor',     href: '/admin/assign-mentor',    icon: LinkIcon },
    { label: 'Issue Certificate', href: '/admin/issue-certificate', icon: GraduationCap },
    { label: 'Verify Docs',       href: '/admin/documents',        icon: FileCheck },
    { label: 'Confirm Extensions',href: '/admin/extension-requests',icon: Clock },
    { label: 'Notice Board',      href: '/admin/notices',          icon: Bell },
    { label: 'Grievances',        href: '/admin/grievances',       icon: Mail },
    { label: 'Feedback Reports',  href: '/admin/feedback',         icon: MessageSquare },
    { label: 'Create User',       href: '/admin/create-user',      icon: UserPlus },
    { label: 'Settings',          href: '/admin/settings',         icon: Settings },
  ],
  mentor: [
    { label: 'Dashboard',      href: '/mentor',                    icon: Home },
    { label: 'Attendance',     href: '/mentor/attendance',         icon: Calendar },
    { label: 'Assignments',    href: '/mentor/assignments',        icon: ClipboardList },
    { label: 'Materials',      href: '/mentor/materials',           icon: FolderOpen },
    { label: 'Intern Reviews', href: '/mentor/intern-reviews',     icon: FileText },
    { label: 'Extensions',     href: '/mentor/extension-requests', icon: Clock },
    { label: 'Notice Board',   href: '/mentor/notices',            icon: Bell },
    { label: 'Intern Feedback',href: '/mentor/intern-feedback',    icon: MessageSquare },
    { label: 'Approve Cert',   href: '/mentor/approve-certificate', icon: GraduationCap },
    { label: 'Settings',       href: '/mentor/settings',            icon: Settings },
  ],
  student: [
    { label: 'Dashboard',     href: '/student',             icon: Home },
    { label: 'Attendance',    href: '/student/attendance',  icon: Calendar },
    { label: 'Daily Logbook', href: '/student/logbook',     icon: BookOpen },
    { label: 'Leave Apply',   href: '/student/leaves',      icon: Mail },
    { label: 'Assignments',   href: '/student/assignments', icon: ClipboardList },
    { label: 'Materials',     href: '/student/materials',   icon: FolderOpen },
    { label: 'Upload Docs',   href: '/student/documents',   icon: FileCheck },
    { label: 'Extension Apply',href: '/student/extension',  icon: Clock },
    { label: 'Notice Board',   href: '/student/notices',     icon: Bell },
    { label: 'My Stipend',    href: '/student/stipend',     icon: DollarSign },
    { label: 'Feedback',      href: '/student/feedback',    icon: MessageSquare },
    { label: 'Grievance',     href: '/student/grievance',   icon: Mail },
    { label: 'Certificate',   href: '/student/certificate', icon: GraduationCap },
    { label: 'Settings',      href: '/student/settings',    icon: Settings },
  ],
  employee: [
    { label: 'Dashboard',    href: '/employee',        icon: Home },
    { label: 'Review LoR',   href: '/employee/review', icon: FileText },
    { label: 'Notice Board', href: '/employee/notices',icon: Bell },
    { label: 'Settings',     href: '/employee/settings',icon: Settings },
  ],
  finance: [
    { label: 'Dashboard',    href: '/finance',          icon: Home },
    { label: 'Payments',     href: '/finance/payments', icon: DollarSign },
    { label: 'Settings',     href: '/finance/settings', icon: Settings },
  ]
}

const roleColors: Record<string, string> = { admin: 'bg-red-500', mentor: 'bg-amber-500', student: 'bg-green-600', employee: 'bg-purple-500', finance: 'bg-blue-600' }
const roleBadge: Record<string, string> = { admin: 'bg-red-50 text-red-700', mentor: 'bg-amber-50 text-amber-700', student: 'bg-green-50 text-green-700', employee: 'bg-purple-50 text-purple-700', finance: 'bg-blue-50 text-blue-700' }

export default function Sidebar({ role, userName }: { role: string; userName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = navByRole[role] || []
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed') === 'true'
    setIsCollapsed(stored)
    document.documentElement.style.setProperty('--sidebar-w', stored ? '4.5rem' : '14rem')
  }, [])

  const toggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
    document.documentElement.style.setProperty('--sidebar-w', next ? '4.5rem' : '14rem')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Clear the backup session cookie
    document.cookie = 'mcl-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    // Clear any sb-* cookies
    document.cookie.split(';').forEach(c => {
      const name = c.split('=')[0].trim()
      if (name.startsWith('sb-')) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      }
    })
    router.push('/login')
  }

  return (
    <aside className={clsx(
      "min-h-screen glass-panel flex flex-col fixed left-0 top-0 z-10 text-slate-300 select-none overflow-visible",
      isCollapsed ? "collapsed-mode w-18" : "w-56"
    )}>
      {/* Brand Header */}
      <div className={clsx("p-4 border-b border-white/5", isCollapsed ? "flex justify-center" : "")}>
        <div className="flex items-center gap-2.5">
          <img src="/mcl-logo-transparent.png" alt="MCL Logo" className="w-9 h-9 object-contain rounded-lg brightness-0 invert flex-shrink-0" />
          {!isCollapsed && (
            <div className="transition-all duration-300">
              <p className="text-sm font-extrabold text-white leading-tight tracking-tight">MCL Portal</p>
              <span className={clsx('text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider mt-1 inline-block', {
                'bg-red-500/10 text-red-400 border border-red-500/25': role === 'admin',
                'bg-amber-500/10 text-amber-400 border border-amber-500/25': role === 'mentor',
                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25': role === 'student',
                'bg-purple-500/10 text-purple-400 border border-purple-500/25': role === 'employee',
                'bg-blue-500/10 text-blue-400 border border-blue-500/25': role === 'finance',
              })}>{role}</span>
            </div>
          )}
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
        {navItems.map(item => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={clsx(
                'group relative flex items-center rounded-xl text-sm transition-all duration-300 transform active:scale-[0.98]',
                isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5',
                isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 font-semibold border-l-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              )}>
              <item.icon className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
              
              {/* Tooltip helper when collapsed */}
              {isCollapsed && (
                <div className="sidebar-tooltip absolute left-full ml-3 px-2 py-1 bg-gray-900/95 text-white text-[11px] font-semibold rounded-lg shadow-lg border border-white/10 whitespace-nowrap z-50 pointer-events-none">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Section & Collapse Toggle */}
      <div className="p-3 border-t border-emerald-950/60 space-y-2">
        <div className={clsx(
          "flex items-center bg-emerald-950/20 rounded-xl border border-emerald-950/30",
          isCollapsed ? "justify-center p-2" : "gap-2.5 px-2 py-2"
        )}>
          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm', roleColors[role])}>
            {userName?.charAt(0)?.toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 transition-all duration-300">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-[10px] text-slate-400 capitalize">{role}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-1">
          <button onClick={handleLogout}
            className={clsx(
              "text-left text-red-400 hover:bg-red-950/30 rounded-xl transition-all duration-300 font-medium",
              isCollapsed ? "flex justify-center p-2.5" : "px-3 py-2 text-xs"
            )}>
            {isCollapsed ? "✕" : "Sign out"}
          </button>

          {/* Toggle Sidebar Collapse button */}
          <button 
            onClick={toggleCollapse}
            className="w-full text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-xl p-2 flex justify-center transition-colors mt-1"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  )
}
