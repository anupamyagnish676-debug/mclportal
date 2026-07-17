import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, Bell, Settings } from 'lucide-react'

export default async function EmployeePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .maybeSingle()

  const firstName = profile?.full_name?.split(' ')[0] || 'Employee'

  const featureCards = [
    {
      label: 'Review LoR',
      desc: 'Review letter of recommendation requests from students',
      href: '/employee/review',
      icon: FileText,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50 hover:bg-blue-100/80',
      text: 'text-blue-700',
    },
    {
      label: 'Notice Board',
      desc: 'View announcements from administration',
      href: '/employee/notices',
      icon: Bell,
      color: 'from-rose-500 to-rose-600',
      bg: 'bg-rose-50 hover:bg-rose-100/80',
      text: 'text-rose-700',
    },
    {
      label: 'Settings',
      desc: 'Manage your account & preferences',
      href: '/employee/settings',
      icon: Settings,
      color: 'from-slate-500 to-slate-600',
      bg: 'bg-slate-50 hover:bg-slate-100/80',
      text: 'text-slate-700',
    },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome, {firstName} 👋</h1>
        <p className="text-gray-500 text-sm">Mahanadi Coalfields Limited — Employee Portal</p>
      </div>

      {/* Feature Hub */}
      <div>
        <h2 className="font-bold text-gray-800 text-sm mb-4">All Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {featureCards.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className={`group flex flex-col gap-4 p-5 rounded-xl border border-gray-100 ${card.bg} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-transparent`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className={`text-base font-semibold ${card.text}`}>{card.label}</p>
                <p className="text-xs text-gray-500 mt-1 leading-snug">{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
