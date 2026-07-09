import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export default async function StudentStipendPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'student') redirect('/login')

  const adminClient = createAdminClient()

  // Fetch student's internship details
  const { data: internship } = await adminClient
    .from('internships')
    .select('id, internship_type, stipend_amount, stipend_frequency')
    .eq('student_id', user.id)
    .maybeSingle()

  if (!internship) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-150 text-center">
        <h2 className="text-lg font-bold text-gray-900">No Internship Active</h2>
        <p className="text-sm text-gray-500">Stipend tracker is only active during training.</p>
      </div>
    )
  }

  const isPaid = internship.internship_type === 'paid'

  // Fetch payment records
  const { data: payments } = await adminClient
    .from('stipend_payments')
    .select('*')
    .eq('internship_id', internship.id)
    .order('created_at', { ascending: false })

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-700 border border-amber-200',
      approved: 'bg-blue-50 text-blue-700 border border-blue-200',
      disbursed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border border-red-200',
    }
    return map[status] || 'bg-gray-50 text-gray-600 border border-gray-200'
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Stipend & Allowances</h1>
        <p className="text-sm text-gray-500">Track monthly internship stipend disbursements.</p>
      </div>

      {!isPaid ? (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center space-y-2">
          <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center text-xl mx-auto font-bold">
            i
          </div>
          <h2 className="text-lg font-bold text-gray-800">Unpaid Internship Program</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Your internship is registered under the unpaid category. No monthly allowance or stipend is applicable for this training program.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Configured Stipend Rate</p>
              <p className="text-3xl font-extrabold text-green-700 mt-1">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(internship.stipend_amount || 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1 capitalize">Disbursed: {internship.stipend_frequency}</p>
            </div>
            <div className="text-xs text-gray-500 text-right bg-green-50/50 px-4 py-3 rounded-2xl border border-green-100/50">
              <span className="font-semibold text-green-800 block">💸 Paid Internship Status</span>
              Processed through Training HRD &amp; Finance wing.
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <h2 className="font-bold text-gray-800 text-sm">Disbursement History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Period</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Disbursed Date</th>
                    <th className="p-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="p-4 font-semibold text-gray-900">{p.period_label}</td>
                      <td className="p-4 font-bold text-gray-800">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p.amount)}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${statusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-500">
                        {p.disbursed_at 
                          ? new Date(p.disbursed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'
                        }
                      </td>
                      <td className="p-4 text-xs text-gray-400 italic max-w-xs truncate">
                        {p.remarks || '—'}
                      </td>
                    </tr>
                  ))}
                  {(!payments || payments.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                        No stipend cycles have been requested by HRD yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
