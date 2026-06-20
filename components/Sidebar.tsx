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
    <aside className="w-56 min-h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-10">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <img src="/mcl-logo.jpg" alt="MCL Logo" className="w-9 h-9 object-contain rounded-lg" />
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">MCL Portal</p>
            <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium capitalize', roleBadge[role])}>{role}</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <Link key={item.href} href={item.href}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === item.href ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}>
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2 px-2 py-2 mb-1">
          <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0', roleColors[role])}>
            {userName?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-400 capitalize">{role}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          Sign out
        </button>
      </div>
    </aside>
  )
}
