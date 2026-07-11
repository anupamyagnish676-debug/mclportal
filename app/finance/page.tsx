'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Calendar,
  User,
  MapPin,
  Landmark,
  FileText,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  Loader2
} from 'lucide-react'

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

export default function FinanceDashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'payments' | 'verification'>('payments')
  
  // Dashboard stats & lists
  const [payments, setPayments] = useState<any[]>([])
  const [pendingInterns, setPendingInterns] = useState<any[]>([])
  const [verifiedInterns, setVerifiedInterns] = useState<any[]>([])
  const [selectedIntern, setSelectedIntern] = useState<any | null>(null)
  const [internDocs, setInternDocs] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  
  // Finance decision inputs
  const [stipendAmount, setStipendAmount] = useState('')
  const [stipendFrequency, setStipendFrequency] = useState<'monthly' | 'lumpsum'>('monthly')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // New payout cycle creation inputs
  const [createInternId, setCreateInternId] = useState('')
  const [createPeriod, setCreatePeriod] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  // Generate last 12 months as dropdown options (current month first)
  const monthOptions = (() => {
    const months = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      months.push(label)
    }
    return months
  })()

  // Payment cycle action states
  const [cycleRemarks, setCycleRemarks] = useState<Record<string, string>>({})
  const [cycleLoading, setCycleLoading] = useState<Record<string, boolean>>({})

  async function loadDashboardData() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stipend/finance-data')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load finance data')

      setPayments(data.payments || [])
      setPendingInterns(data.pending || [])
      setVerifiedInterns(data.verified || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load finance portal data')
    } finally {
      setLoading(false)
    }
  }

  // Load student onboarding documents dynamically when selected
  async function loadStudentDocs(studentId: string) {
    setDocsLoading(true)
    setInternDocs([])
    try {
      const { data, error } = await supabase
        .from('student_documents')
        .select('id, doc_type, file_url, status, rejection_reason')
        .eq('student_id', studentId)
      
      if (error) throw error
      setInternDocs(data || [])
    } catch (err: any) {
      console.error('Failed to load student onboarding documents:', err.message)
    } finally {
      setDocsLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Handle monthly cycle payouts (disbursements / approvals)
  async function handleCycleAction(paymentId: string, status: 'approved' | 'disbursed' | 'rejected') {
    setCycleLoading(prev => ({ ...prev, [paymentId]: true }))
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/stipend', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentId,
          status,
          remarks: cycleRemarks[paymentId] || ''
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update payment status')
      
      setSuccess(`Payment cycle updated successfully to ${status}!`)
      loadDashboardData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCycleLoading(prev => ({ ...prev, [paymentId]: false }))
    }
  }

  // Handle bank account details verification (approve & config or reject)
  async function handleBankVerification(status: 'verified' | 'rejected') {
    if (!selectedIntern) return
    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      const payload: Record<string, any> = {
        internship_id: selectedIntern.id,
        action: 'verify_bank',
        status
      }

      if (status === 'verified') {
        if (!stipendAmount || parseFloat(stipendAmount) <= 0) {
          throw new Error('Please enter a valid stipend amount (₹) for this student.')
        }
        payload.amount = parseFloat(stipendAmount)
        payload.frequency = stipendFrequency
      } else {
        if (!rejectionReason.trim()) {
          throw new Error('Please specify a reason for rejecting the bank details.')
        }
        payload.rejection_reason = rejectionReason
      }

      const res = await fetch('/api/stipend', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to process bank details verification')

      setSuccess(`Student bank account details successfully ${status === 'verified' ? 'Approved & Configured' : 'Rejected'}!`)
      setSelectedIntern(null)
      setShowRejectInput(false)
      setRejectionReason('')
      setStipendAmount('')
      loadDashboardData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCreateCycle(e: React.FormEvent) {
    e.preventDefault()
    if (!createInternId || !createPeriod.trim()) {
      setError('Please select an intern and specify a period.')
      return
    }

    setCreateLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/stipend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internship_id: createInternId,
          period_label: createPeriod.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to initiate payout cycle')

      setSuccess(`Stipend payout cycle for "${createPeriod}" initiated successfully!`)
      setCreateInternId('')
      setCreatePeriod('')
      loadDashboardData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreateLoading(false)
    }
  }

  // Summary stats calculations
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const pendingCycles = payments.filter(p => p.status === 'pending')
  const approvedThisMonth = payments.filter(p => p.status === 'approved' && p.created_at?.startsWith(thisMonth))
  const disbursedThisMonth = payments.filter(p => p.status === 'disbursed' && p.disbursed_at?.startsWith(thisMonth))
  const rejectedCycles = payments.filter(p => p.status === 'rejected')

  const pendingAmount = pendingCycles.reduce((s, p) => s + (p.amount || 0), 0)
  const approvedAmount = approvedThisMonth.reduce((s, p) => s + (p.amount || 0), 0)
  const disbursedAmount = disbursedThisMonth.reduce((s, p) => s + (p.amount || 0), 0)

  if (loading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Finance Department</h1>
          <p className="text-gray-500 text-sm">
            Mahanadi Coalfields Limited — Stipend Disbursement &amp; Onboarding Verification
          </p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl self-start md:self-auto border border-gray-200">
          <button
            onClick={() => { setActiveTab('payments'); setSelectedIntern(null); }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'payments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            💸 Payout Cycles ({pendingCycles.length} Pending)
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'verification' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            🏢 Bank &amp; Doc Verification ({pendingInterns.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {activeTab === 'payments' ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 flex items-start gap-4 border border-gray-100 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 border border-amber-100">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 leading-none">{pendingCycles.length}</p>
                <p className="text-xs text-gray-500 mt-1">Pending Cycles</p>
                <p className="text-xs font-semibold text-gray-700 mt-1">{fmtCurrency(pendingAmount)}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 flex items-start gap-4 border border-gray-100 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 leading-none">{approvedThisMonth.length}</p>
                <p className="text-xs text-gray-500 mt-1">Approved This Month</p>
                <p className="text-xs font-semibold text-gray-700 mt-1">{fmtCurrency(approvedAmount)}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 flex items-start gap-4 border border-gray-100 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600 leading-none">{disbursedThisMonth.length}</p>
                <p className="text-xs text-gray-500 mt-1">Disbursed This Month</p>
                <p className="text-xs font-semibold text-gray-700 mt-1">{fmtCurrency(disbursedAmount)}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 flex items-start gap-4 border border-gray-100 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 border border-red-100">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 leading-none">{rejectedCycles.length}</p>
                <p className="text-xs text-gray-500 mt-1">Rejected Cycles</p>
              </div>
            </div>
          </div>

          {/* Initiate Payout Cycle Form */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div className="border-b border-gray-50 pb-2">
              <h2 className="font-bold text-gray-800 text-sm">Initiate Payout Cycle</h2>
              <p className="text-xs text-gray-400">Request monthly stipend payout for a verified paid intern.</p>
            </div>
            
            {verifiedInterns.length === 0 ? (
              <p className="text-xs text-gray-505 italic bg-slate-50 p-3 rounded-xl flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>No verified paid interns available in your area. Go to the <strong>Bank &amp; Doc Verification</strong> tab to verify student accounts first.</span>
              </p>
            ) : (
              <form onSubmit={handleCreateCycle} className="space-y-4">
                {/* Warning banner — shown when selected intern was paid within last 30 days */}
                {(() => {
                  if (!createInternId) return null
                  const intern = verifiedInterns.find((i: any) => i.id === createInternId)
                  if (!intern?.latest_payment_date) return null
                  const daysSince = Math.floor(
                    (Date.now() - new Date(intern.latest_payment_date).getTime()) / (1000 * 60 * 60 * 24)
                  )
                  if (daysSince >= 30) return null
                  return (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        <strong>Warning:</strong> A stipend payout cycle was already initiated for this student{' '}
                        <strong>{daysSince} day{daysSince !== 1 ? 's' : ''} ago</strong>{' '}
                        (on {new Date(intern.latest_payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}).
                        Please verify before proceeding.
                      </p>
                    </div>
                  )
                })()}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Select Intern
                    </label>
                    <select
                      value={createInternId}
                      onChange={(e) => setCreateInternId(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value="">-- Choose Intern --</option>
                      {verifiedInterns.map((i: any) => (
                        <option key={i.id} value={i.id}>
                          {i.student?.full_name} · MCL/HRD/INT/{i.serial_no ?? '?'} · {fmtCurrency(i.stipend_amount)}/{i.stipend_frequency}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Payout Month &amp; Year
                    </label>
                    <select
                      value={createPeriod}
                      onChange={(e) => setCreatePeriod(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value="">-- Select Month --</option>
                      {monthOptions.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="w-full bg-green-700 hover:bg-green-800 text-white rounded-xl py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {createLoading ? 'Requesting...' : 'Request Payout Cycle'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Payout Cycles Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-sm">Monthly Payout Requests</h2>
            </div>

            {payments.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm italic">
                No monthly stipend payout requests found in the system.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Location &amp; Wing</th>
                      <th className="px-5 py-3">Period</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3">Actions &amp; Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900 text-xs leading-tight">
                            {p.internship?.student?.full_name || '—'}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {p.internship?.student?.email || ''}
                          </p>
                          <p className="text-[10px] text-gray-300 mt-0.5 font-mono">
                            MCL/HRD/INT/{p.internship?.serial_no ?? '—'}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-600">
                          {p.internship?.area} Area
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-600">{p.period_label}</td>
                        <td className="px-5 py-4 text-right text-xs font-bold text-gray-800">
                          {fmtCurrency(p.amount || 0)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusBadge(p.status)}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {p.status === 'pending' && (
                            <div className="flex flex-col gap-2 max-w-xs">
                              <input
                                type="text"
                                placeholder="Add optional remarks..."
                                value={cycleRemarks[p.id] || ''}
                                onChange={(e) => setCycleRemarks(prev => ({ ...prev, [p.id]: e.target.value }))}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCycleAction(p.id, 'approved')}
                                  disabled={cycleLoading[p.id]}
                                  className="px-2 py-1 text-[10px] bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleCycleAction(p.id, 'rejected')}
                                  disabled={cycleLoading[p.id]}
                                  className="px-2 py-1 text-[10px] bg-red-600 text-white font-bold rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          )}
                          {p.status === 'approved' && (
                            <div className="flex flex-col gap-2 max-w-xs">
                              <input
                                type="text"
                                placeholder="Add payment reference / remarks..."
                                value={cycleRemarks[p.id] || ''}
                                onChange={(e) => setCycleRemarks(prev => ({ ...prev, [p.id]: e.target.value }))}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                              />
                              <button
                                onClick={() => handleCycleAction(p.id, 'disbursed')}
                                disabled={cycleLoading[p.id]}
                                className="w-fit px-3 py-1 text-[10px] bg-green-600 text-white font-bold rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                Mark Disbursed
                              </button>
                            </div>
                          )}
                          {(p.status === 'disbursed' || p.status === 'rejected') && (
                            <p className="text-xs text-gray-500 italic max-w-xs truncate">
                              {p.remarks || '—'}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Tab 2: Bank & Document Verification panel */
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {/* List panel */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 text-sm mb-4">Paid Students list</h2>
              {pendingInterns.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6">
                  No students awaiting bank details verification.
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingInterns.map((intern) => (
                    <button
                      key={intern.id}
                      onClick={() => {
                        setSelectedIntern(intern)
                        loadStudentDocs(intern.student?.id)
                        setStipendAmount('')
                        setShowRejectInput(false)
                        setRejectionReason('')
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group ${
                        selectedIntern?.id === intern.id
                          ? 'border-green-600 bg-green-50/20 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-gray-900 text-xs truncate">
                          {intern.student?.full_name || 'Student'}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{intern.student?.email}</p>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide mt-1.5 border ${
                          intern.bank_details_status === 'submitted'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : intern.bank_details_status === 'rejected'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}>
                          {intern.bank_details_status === 'pending' ? 'Waiting Submission' : intern.bank_details_status}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Details & Actions Panel */}
          <div className="md:col-span-2">
            {!selectedIntern ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-xs italic shadow-sm">
                Select a student from the list to review onboarding documents, bank accounts, and configure stipend parameters.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 space-y-6 shadow-sm">
                {/* Header info */}
                <div className="border-b border-gray-100 pb-4">
                  <span className="text-[10px] bg-green-100 text-green-800 font-bold uppercase px-2 py-0.5 rounded-full">
                    Paid Category Intern
                  </span>
                  <h2 className="text-xl font-bold text-gray-900 mt-2">{selectedIntern.student?.full_name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedIntern.student?.email} • {selectedIntern.student?.wing || 'General'} Department</p>
                  <p className="text-xs text-gray-400 mt-1">Location: {selectedIntern.student?.area} Area</p>
                </div>

                {/* Onboarding Documents Grid */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Onboarding Identity Documents</h3>
                  {docsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                      Loading files...
                    </div>
                  ) : internDocs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic bg-gray-50 rounded-xl p-3 text-center">
                      No onboarding documents uploaded by the student yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {internDocs.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-gray-250 hover:bg-slate-50/50 transition-all text-xs font-medium text-gray-700 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="truncate capitalize">{doc.doc_type.replace('_', ' ')}</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                            doc.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {doc.status}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bank Account Details Form */}
                <div className="bg-slate-50/80 rounded-2xl border border-gray-150 p-5 space-y-4">
                  <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-blue-600" />
                    Bank Account Details
                  </h3>

                  {selectedIntern.bank_details_status === 'pending' ? (
                    <div className="text-xs text-gray-500 py-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <span>Student has not submitted their bank details for verification yet.</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Bank Name</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{selectedIntern.bank_name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Account Number</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{selectedIntern.bank_account_no}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">IFSC Code</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{selectedIntern.bank_ifsc_code}</p>
                        </div>
                      </div>

                      {selectedIntern.bank_document_url && (
                        <div className="pt-2 border-t border-gray-150">
                          <a
                            href={selectedIntern.bank_document_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                          >
                            📄 View Cancelled Cheque / Passbook Copy
                          </a>
                        </div>
                      )}

                      {/* Financial configuration parameters */}
                      {selectedIntern.bank_details_status === 'submitted' && !showRejectInput && (
                        <div className="pt-4 border-t border-gray-150 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                              Configure Stipend Amount (₹)
                            </label>
                            <input
                              type="number"
                              required
                              placeholder="e.g. 8000"
                              value={stipendAmount}
                              onChange={(e) => setStipendAmount(e.target.value)}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                              Payment Frequency
                            </label>
                            <select
                              value={stipendFrequency}
                              onChange={(e) => setStipendFrequency(e.target.value as any)}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                            >
                              <option value="monthly">Monthly Disbursement</option>
                              <option value="lumpsum">Lumpsum Payout</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {showRejectInput && (
                        <div className="pt-4 border-t border-gray-150 space-y-2">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Rejection Reason
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Enter the reason why these bank details are incorrect or unacceptable..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                          />
                        </div>
                      )}

                      {/* Main verification buttons */}
                      {selectedIntern.bank_details_status === 'submitted' && (
                        <div className="flex gap-2 pt-2 justify-end">
                          {showRejectInput ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowRejectInput(false)}
                                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBankVerification('rejected')}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                              >
                                {actionLoading ? 'Processing...' : 'Confirm Rejection'}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowRejectInput(true)}
                                className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50/50 rounded-xl text-xs font-semibold transition-colors"
                              >
                                Reject Details
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBankVerification('verified')}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                {actionLoading ? 'Verifying...' : 'Verify & Approve Stipend'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
