'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'

type NavItem = { label: string; href: string; icon: string }

const navByRole: Record<string, NavItem[]> = {
  admin: [
    { label: 'Dashboard',     href: '/admin',              icon: '🏠' },
    { label: 'Applications',  href: '/admin/applications', icon: '📋' },
    { label: 'Interns',       href: '/admin/interns',      icon: '👥' },
    { label: 'Departments',   href: '/admin/departments',  icon: '🏢' },
    { label: 'Bulk Onboard',  href: '/admin/bulk-onboarding', icon: '📥' },
    { label: 'Assign Mentor', href: '/admin/assign-mentor', icon: '🔗' },
    { label: 'Create User',   href: '/admin/create-user',  icon: '➕' },
    { label: 'Settings',      href: '/admin/settings',     icon: '⚙️' },
  ],
  mentor: [
    { label: 'Dashboard',      href: '/mentor',                    icon: '🏠' },
    { label: 'Attendance',     href: '/mentor/attendance',         icon: '📅' },
    { label: 'Assignments',    href: '/mentor/assignments',        icon: '📝' },
    { label: 'Materials',      href: '/mentor/materials',           icon: '📂' },
    { label: 'Intern Reviews', href: '/mentor/intern-reviews',     icon: '📋' },
    { label: 'Approve Cert',   href: '/mentor/approve-certificate', icon: '🎓' },
    { label: 'Settings',       href: '/mentor/settings',            icon: '⚙️' },
  ],
  student: [
    { label: 'Dashboard',     href: '/student',             icon: '🏠' },
    { label: 'Attendance',    href: '/student/attendance',  icon: '📅' },
    { label: 'Daily Logbook', href: '/student/logbook',     icon: '📔' },
    { label: 'Leave Apply',   href: '/student/leaves',      icon: '✉️' },
    { label: 'Assignments',   href: '/student/assignments', icon: '📝' },
    { label: 'Materials',     href: '/student/materials',   icon: '📂' },
    { label: 'Certificate',   href: '/student/certificate', icon: '🎓' },
    { label: 'Settings',      href: '/student/settings',    icon: '⚙️' },
  ],
  employee: [
    { label: 'Dashboard',  href: '/employee',        icon: '🏠' },
    { label: 'Review LoR', href: '/employee/review', icon: '📋' },
    { label: 'Settings',   href: '/employee/settings',icon: '⚙️' },
  ],
}

const roleColors: Record<string, string> = { admin: 'bg-red-500', mentor: 'bg-amber-500', student: 'bg-green-600', employee: 'bg-purple-500' }
const roleBadge: Record<string, string> = { admin: 'bg-red-50 text-red-700', mentor: 'bg-amber-50 text-amber-700', student: 'bg-green-50 text-green-700', employee: 'bg-purple-50 text-purple-700' }

export default function Sidebar({ role, userName }: { role: string; userName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = navByRole[role] || []

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
    <aside className="w-56 min-h-screen bg-[#070f0d] border-r border-emerald-950/60 flex flex-col fixed left-0 top-0 z-10 text-slate-300">
      <div className="p-4 border-b border-emerald-950/60">
        <div className="flex items-center gap-2.5">
          <img src="/mcl-logo-transparent.png" alt="MCL Logo" className="w-9 h-9 object-contain rounded-lg brightness-0 invert" />
          <div>
            <p className="text-sm font-bold text-white leading-tight">MCL Portal</p>
            <span className={clsx('text-[10px] px-2 py-0.5 rounded font-semibold capitalize mt-1 inline-block', {
              'bg-red-950/40 text-red-400 border border-red-500/20': role === 'admin',
              'bg-amber-950/40 text-amber-400 border border-amber-500/20': role === 'mentor',
              'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20': role === 'student',
              'bg-purple-950/40 text-purple-400 border border-purple-500/20': role === 'employee',
            })}>{role}</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 transform active:scale-[0.98]',
                isActive 
                  ? 'bg-gradient-to-r from-emerald-950/60 to-emerald-900/40 text-emerald-400 font-semibold border-l-2 border-emerald-500 shadow-sm' 
                  : 'text-slate-400 hover:bg-emerald-950/20 hover:text-slate-200'
              )}>
              <span className="text-base group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-emerald-950/60">
        <div className="flex items-center gap-2.5 px-2 py-2 mb-1.5 bg-emerald-950/20 rounded-xl border border-emerald-950/30">
          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm', roleColors[role])}>
            {userName?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{userName}</p>
            <p className="text-[10px] text-slate-400 capitalize">{role}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 rounded-xl transition-all duration-300 font-medium">
          Sign out
        </button>
      </div>
    </aside>
  )
}
