import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Calendar,
  User,
  MapPin,
} from 'lucide-react'

export const revalidate = 0

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    approved: 'bg-blue-50 text-blue-700 border border-blue-200',
    disbursed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  return map[status] || 'bg-gray-50 text-gray-600 border border-gray-200'
}

export default async function FinanceDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'finance') return redirect('/login')

  const adminClient = createAdminClient()

  // Fetch all payments
  const { data: allPayments } = await adminClient
    .from('stipend_payments')
    .select(`
      *,
      internship:internships(
        area,
        student:profiles!internships_student_id_fkey(full_name, email, area)
      )
    `)
    .order('created_at', { ascending: false })

  const payments = allPayments || []

  // Summary stats
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const pending = payments.filter(p => p.status === 'pending')
  const approvedThisMonth = payments.filter(
    p => p.status === 'approved' && p.created_at?.startsWith(thisMonth)
  )
  const disbursedThisMonth = payments.filter(
    p => p.status === 'disbursed' && p.disbursed_at?.startsWith(thisMonth)
  )
  const rejected = payments.filter(p => p.status === 'rejected')

  const pendingAmount = pending.reduce((s: number, p: any) => s + (p.amount || 0), 0)
  const approvedAmount = approvedThisMonth.reduce((s: number, p: any) => s + (p.amount || 0), 0)
  const disbursedAmount = disbursedThisMonth.reduce((s: number, p: any) => s + (p.amount || 0), 0)

  const summaryCards = [
    {
      label: 'Pending Payments',
      count: pending.length,
      amount: fmtCurrency(pendingAmount),
      icon: Clock,
      color: 'bg-amber-50 text-amber-600 border border-amber-100',
      textColor: 'text-amber-600',
    },
    {
      label: 'Approved This Month',
      count: approvedThisMonth.length,
      amount: fmtCurrency(approvedAmount),
      icon: CheckCircle2,
      color: 'bg-blue-50 text-blue-600 border border-blue-100',
      textColor: 'text-blue-600',
    },
    {
      label: 'Disbursed This Month',
      count: disbursedThisMonth.length,
      amount: fmtCurrency(disbursedAmount),
      icon: TrendingUp,
      color: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      textColor: 'text-emerald-600',
    },
    {
      label: 'Rejected Payments',
      count: rejected.length,
      amount: '',
      icon: XCircle,
      color: 'bg-red-50 text-red-600 border border-red-100',
      textColor: 'text-red-600',
    },
  ]

  // Recent 10 payments
  const recent = payments.slice(0, 10)

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Finance Dashboard</h1>
        <p className="text-gray-500 text-sm">
          Mahanadi Coalfields Limited — Stipend Management &amp; Disbursement
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="glass-card rounded-2xl p-5 flex items-start gap-4 shadow-sm hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className={`text-2xl font-bold leading-none ${card.textColor}`}>{card.count}</p>
              <p className="text-xs text-gray-500 mt-1 leading-tight">{card.label}</p>
              {card.amount && (
                <p className="text-xs font-semibold text-gray-700 mt-1">{card.amount}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Payments Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-gray-800 text-sm">Recent Payments</h2>
          </div>
          <a
            href="/finance/payments"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
          >
            View all →
          </a>
        </div>

        {recent.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            No stipend payments recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex items-center gap-1.5"><User className="w-3 h-3" />Student</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />Area</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />Period</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 text-xs leading-tight">
                        {p.internship?.student?.full_name || '—'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {p.internship?.student?.email || ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {p.internship?.area || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.period_label || '—'}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">
                      {fmtCurrency(p.amount || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusBadge(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
