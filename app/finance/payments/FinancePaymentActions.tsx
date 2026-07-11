'use client'
import { useState } from 'react'

interface Student {
  full_name: string
  email: string
  university: string
  wing: string
}

interface Internship {
  area: string
  serial_no: string | null
  bank_name: string | null
  bank_account_no: string | null
  bank_ifsc_code: string | null
  end_date: string | null
  stipend_frequency: string
  student: Student
}

interface Payment {
  id: string
  period_label: string
  amount: number
  status: 'pending' | 'approved' | 'disbursed' | 'rejected'
  remarks: string | null
  internship: Internship
}

interface FinancePaymentActionsProps {
  initialPayments: Payment[]
}

export default function FinancePaymentActions({ initialPayments }: FinancePaymentActionsProps) {
  const [items, setItems] = useState<Payment[]>(initialPayments)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectRemarks, setRejectRemarks] = useState<string>('')
  const [utrInputs, setUtrInputs] = useState<Record<string, string>>({})
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // Filter local state
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPeriod, setFilterPeriod] = useState<string>('all')
  const [searchName, setSearchName] = useState<string>('')

  async function handleStatusUpdate(id: string, status: 'approved' | 'disbursed' | 'rejected', remarks?: string) {
    // Require UTR before disbursing
    if (status === 'disbursed') {
      const utr = utrInputs[id]?.trim()
      if (!utr) {
        setError('Please enter the UTR / Transaction Reference Number before marking as Disbursed.')
        return
      }
    }
    setSaving(true)
    setError('')
    try {
      const utr = utrInputs[id]?.trim() || ''
      const payload: any = {
        payment_id: id,
        status,
      }
      if (status === 'rejected') payload.remarks = remarks || ''
      if (status === 'disbursed') payload.remarks = utr

      const res = await fetch('/api/stipend', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update payment status')

      setItems(prev => prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            status,
            remarks: status === 'rejected' ? (remarks || '') : status === 'disbursed' ? utr : item.remarks
          }
        }
        return item
      }))
      setActionId(null)
      setRejectRemarks('')
      setExpandedRow(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const today = new Date()

  const filteredItems = items.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterPeriod !== 'all' && i.period_label !== filterPeriod) return false
    if (searchName.trim() !== '') {
      const studentName = i.internship?.student?.full_name || ''
      if (!studentName.toLowerCase().includes(searchName.toLowerCase())) return false
    }
    return true
  })

  const uniquePeriods = Array.from(new Set(items.map(item => item.period_label))).sort()

  const totalPaidFiltered = filteredItems
    .filter(i => i.status === 'disbursed')
    .reduce((sum, i) => sum + i.amount, 0)

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-700 border border-amber-200',
      approved: 'bg-blue-50 text-blue-700 border border-blue-200',
      disbursed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border border-red-200',
    }
    return map[status] || 'bg-gray-50 text-gray-600 border border-gray-200'
  }

  function isInternshipExpired(endDate: string | null): boolean {
    if (!endDate) return false
    return new Date(endDate) < today
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function maskAccount(accNo: string | null): string {
    if (!accNo) return 'N/A'
    if (accNo.length <= 4) return accNo
    return '•'.repeat(accNo.length - 4) + accNo.slice(-4)
  }

  function exportToCSV() {
    const headers = [
      'Advice Reference ID',
      'Intern Name',
      'Email',
      'University',
      'Area',
      'Department/Wing',
      'Bank Name',
      'Account Number',
      'IFSC Code',
      'Internship End Date',
      'Payout Period',
      'Frequency',
      'Amount (INR)',
      'Status',
      'UTR / Transaction Ref',
    ]

    const rows = filteredItems.map(p => [
      p.id,
      p.internship?.student?.full_name || 'N/A',
      p.internship?.student?.email || 'N/A',
      p.internship?.student?.university || 'N/A',
      p.internship?.area || 'N/A',
      p.internship?.student?.wing || 'N/A',
      p.internship?.bank_name || 'N/A',
      p.internship?.bank_account_no || 'N/A',
      p.internship?.bank_ifsc_code || 'N/A',
      p.internship?.end_date || 'N/A',
      p.period_label,
      p.internship?.stipend_frequency || 'monthly',
      p.amount,
      p.status.toUpperCase(),
      p.remarks || 'N/A',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => {
        const clean = String(val).replace(/"/g, '""')
        return `"${clean}"`
      }).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const dateStr = new Date().toISOString().slice(0, 10)
    link.setAttribute('download', `MCL_Stipend_Disbursements_${filterStatus}_${dateStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4">
      {/* Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl p-2 bg-white focus:outline-none focus:border-green-600"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="disbursed">Disbursed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Month/Period Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Period</label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl p-2 bg-white focus:outline-none focus:border-green-600"
            >
              <option value="all">All Months</option>
              {uniquePeriods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Intern Name Search */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search</label>
            <input
              type="text"
              placeholder="Intern name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl p-2 bg-white focus:outline-none focus:border-green-600 w-44"
            />
          </div>

        </div>

        <button
          onClick={exportToCSV}
          className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm self-end md:self-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Report (Excel/CSV)
        </button>
      </div>

      {/* Summary Stats */}
      <div className="bg-emerald-50/40 border border-emerald-100/50 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-3 gap-4 shadow-sm">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Matched Payments</p>
          <h3 className="text-base font-bold text-gray-800">{filteredItems.length} records</h3>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Disbursed (Cumulative)</p>
          <h3 className="text-base font-bold text-green-700">
            ₹{totalPaidFiltered.toLocaleString('en-IN')}
          </h3>
        </div>
        <div className="col-span-2 md:col-span-1 flex items-center justify-end">
          <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/60 px-3 py-1 rounded-full border border-emerald-200/50">
            {searchName ? `Scoped: "${searchName}"` : 'Real-time Calculations'}
          </span>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center justify-between gap-2">
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold text-sm leading-none">×</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wider">
                <th className="p-4">Intern Details</th>
                <th className="p-4">Area / Wing</th>
                <th className="p-4">Period</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Actions</th>
                <th className="p-4 text-center">Bank Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.map((p) => {
                const expired = isInternshipExpired(p.internship?.end_date)
                const isExpanded = expandedRow === p.id
                const isRejecting = actionId === p.id
                return (
                  <>
                    <tr key={p.id} className={`hover:bg-gray-50/50 transition-colors ${expired && p.status !== 'disbursed' ? 'bg-red-50/20' : ''}`}>
                      <td className="p-4">
                        <div className="font-semibold text-gray-900 text-xs leading-tight">{p.internship?.student?.full_name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{p.internship?.student?.email}</div>
                        <div className="text-[10px] text-gray-300 mt-0.5 font-mono">
                          {p.internship?.serial_no ? `MCL/HRD/INT/${p.internship.serial_no}` : ''}
                        </div>
                        {expired && (
                          <span className="inline-block mt-1 text-[9px] font-bold uppercase bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">
                            ⚠ Internship Ended {formatDate(p.internship?.end_date)}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-medium text-gray-700">{p.internship?.area} Area</div>
                        <div className="text-[10px] text-gray-400">{p.internship?.student?.wing}</div>
                        <div className="text-[10px] text-gray-300 mt-0.5">
                          {p.internship?.stipend_frequency === 'lumpsum' ? 'Lump Sum' : 'Monthly'}
                        </div>
                      </td>
                      <td className="p-4 font-medium text-gray-700 text-xs">{p.period_label}</td>
                      <td className="p-4 text-right font-bold text-gray-900 text-xs">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p.amount)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${statusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5">
                          {p.status === 'pending' && (
                            <div className="flex gap-1.5 flex-wrap">
                              <button
                                onClick={() => { setActionId(p.id); setError('') }}
                                className="text-xs font-bold text-red-600 hover:text-red-700 px-2 py-1 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(p.id, 'approved')}
                                className="text-xs font-bold text-white bg-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                Approve
                              </button>
                            </div>
                          )}

                          {p.status === 'approved' && (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                placeholder="Enter UTR / Ref No. (required)"
                                value={utrInputs[p.id] || ''}
                                onChange={(e) => setUtrInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                                className={`text-[11px] border rounded-lg px-2 py-1.5 w-full focus:outline-none focus:border-green-600 ${
                                  !utrInputs[p.id]?.trim() ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'
                                }`}
                              />
                              <button
                                onClick={() => handleStatusUpdate(p.id, 'disbursed')}
                                disabled={saving || !utrInputs[p.id]?.trim()}
                                className="w-full text-xs font-bold text-white bg-green-700 px-3 py-1.5 rounded-xl hover:bg-green-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {saving ? 'Processing...' : 'Disburse Funds ✓'}
                              </button>
                              {!utrInputs[p.id]?.trim() && (
                                <p className="text-[10px] text-amber-600">UTR required to disburse</p>
                              )}
                            </div>
                          )}

                          {p.status === 'disbursed' && (
                            <div className="space-y-0.5">
                              <p className="text-[10px] text-gray-400 font-bold uppercase">UTR / Ref</p>
                              <p className="text-xs text-gray-700 font-mono font-semibold">{p.remarks || '—'}</p>
                            </div>
                          )}

                          {p.status === 'rejected' && (
                            <p className="text-[10px] text-gray-500 italic max-w-[140px] break-words">{p.remarks || '—'}</p>
                          )}
                        </div>

                        {/* Reject panel */}
                        {isRejecting && (
                          <div className="mt-2 space-y-1.5 bg-red-50/30 border border-red-100 rounded-xl p-3">
                            <input
                              type="text"
                              value={rejectRemarks}
                              onChange={(e) => setRejectRemarks(e.target.value)}
                              placeholder="Reason for rejection (required)..."
                              className="w-full text-xs border border-red-200 rounded-lg p-2 bg-white focus:outline-none"
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setActionId(null)}
                                className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(p.id, 'rejected', rejectRemarks)}
                                disabled={saving || !rejectRemarks.trim()}
                                className="flex-1 px-2 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-40"
                              >
                                {saving ? '...' : 'Confirm'}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Bank Info Toggle */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : p.id)}
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1 mx-auto ${
                            isExpanded
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          🏦 {isExpanded ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>

                    {/* Bank Account Details Expandable Row */}
                    {isExpanded && (
                      <tr className="bg-blue-50/30 border-b border-blue-100">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-sm font-bold text-gray-800">🏦 Bank Account Details</span>
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">For Fund Transfer</span>
                              {p.internship?.bank_account_no && (
                                <span className="text-[10px] text-gray-400 ml-auto">Copy details below to initiate NEFT/RTGS/IMPS transfer</span>
                              )}
                            </div>

                            {!p.internship?.bank_account_no ? (
                              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                                ⚠ Bank account details not available for this intern. Please verify bank details in the Bank &amp; Doc Verification tab.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Beneficiary Name</p>
                                  <p className="text-xs font-bold text-gray-900">{p.internship?.student?.full_name}</p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank Name</p>
                                  <p className="text-xs font-bold text-gray-900">{p.internship?.bank_name || 'N/A'}</p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account Number</p>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-mono font-bold text-gray-900 tracking-wider">{p.internship?.bank_account_no}</p>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(p.internship?.bank_account_no || '')}
                                      title="Copy account number"
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold border border-blue-200 rounded px-1 py-0.5 hover:bg-blue-50 transition-colors"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IFSC Code</p>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-mono font-bold text-gray-900 tracking-widest">{p.internship?.bank_ifsc_code || 'N/A'}</p>
                                    {p.internship?.bank_ifsc_code && (
                                      <button
                                        onClick={() => navigator.clipboard.writeText(p.internship?.bank_ifsc_code || '')}
                                        title="Copy IFSC code"
                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold border border-blue-200 rounded px-1 py-0.5 hover:bg-blue-50 transition-colors"
                                      >
                                        Copy
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Transfer Amount</p>
                                  <p className="text-xs font-bold text-green-700 text-base">
                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p.amount)}
                                  </p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payout Period</p>
                                  <p className="text-xs font-semibold text-gray-700">{p.period_label}</p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Internship End Date</p>
                                  <p className={`text-xs font-semibold ${expired ? 'text-red-600' : 'text-gray-700'}`}>
                                    {formatDate(p.internship?.end_date)} {expired ? '⚠ Ended' : ''}
                                  </p>
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Student Email</p>
                                  <p className="text-xs text-gray-600">{p.internship?.student?.email || 'N/A'}</p>
                                </div>
                              </div>
                            )}

                            <p className="text-[10px] text-gray-400 mt-3 border-t border-gray-100 pt-3">
                              🔒 After completing the bank transfer via your government banking system, enter the UTR/Transaction Reference in the Actions column above and click <strong>Disburse Funds</strong> to record it.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400 italic text-sm">
                    No stipend payments matched the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
