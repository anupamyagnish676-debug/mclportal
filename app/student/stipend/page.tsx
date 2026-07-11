'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BankDetailsForm from './BankDetailsForm'
import { DollarSign, Landmark, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'

export default function StudentStipendPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [internship, setInternship] = useState<any | null>(null)
  const [payments, setPayments] = useState<any[]>([])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch student's internship details
      const { data: internshipData } = await supabase
        .from('internships')
        .select('id, internship_type, stipend_amount, stipend_frequency, bank_name, bank_account_no, bank_ifsc_code, bank_details_status, bank_rejection_reason')
        .eq('student_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (internshipData) {
        setInternship(internshipData)

        // Fetch payment records
        const { data: paymentsData } = await supabase
          .from('stipend_payments')
          .select('*')
          .eq('internship_id', internshipData.id)
          .order('created_at', { ascending: false })

        setPayments(paymentsData || [])
      }
    } catch (err) {
      console.error('Failed to load stipend data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-700 border border-amber-200',
      approved: 'bg-blue-50 text-blue-700 border border-blue-200',
      disbursed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border border-red-200',
    }
    return map[status] || 'bg-gray-50 text-gray-600 border border-gray-200'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!internship) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-150 text-center">
        <h2 className="text-lg font-bold text-gray-900">No Internship Active</h2>
        <p className="text-sm text-gray-500">Stipend tracker is only active during training.</p>
      </div>
    )
  }

  const isPaid = internship.internship_type === 'paid'

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
          {/* Bank Details Onboarding Statuses */}
          {internship.bank_details_status === 'pending' || internship.bank_details_status === 'rejected' ? (
            <BankDetailsForm 
              rejectionReason={internship.bank_rejection_reason} 
              onSuccess={loadData} 
            />
          ) : internship.bank_details_status === 'submitted' ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-start gap-4">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-gray-900">Bank Details Submitted</h3>
                <p className="text-gray-500 text-sm">
                  Your details (<strong>{internship.bank_name}</strong> - Account ending in ...{internship.bank_account_no?.slice(-4)}) have been submitted and are currently undergoing verification by the Finance Department. 
                </p>
                <p className="text-xs text-gray-400">Once verified, your monthly allowance rates will be configured.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Verified State - show Configured Rates and Bank Info */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Rate Card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Configured Stipend Rate</p>
                    <p className="text-3xl font-extrabold text-green-700 mt-1">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(internship.stipend_amount || 0)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 capitalize">Disbursed: {internship.stipend_frequency}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-xl text-green-600">
                    <DollarSign className="w-8 h-8" />
                  </div>
                </div>

                {/* Account Card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Disbursement Account</p>
                    <p className="text-lg font-bold text-gray-800 mt-1">{internship.bank_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">A/C: ...{internship.bank_account_no?.slice(-4)}</p>
                    <p className="text-[10px] text-gray-400">IFSC: {internship.bank_ifsc_code}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <Landmark className="w-8 h-8" />
                  </div>
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
                      {payments.map((p: any) => (
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
                      {payments.length === 0 && (
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
