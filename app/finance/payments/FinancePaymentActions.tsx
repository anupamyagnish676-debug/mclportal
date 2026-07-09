'use client'
import { useState } from 'react'

interface Student {
  full_name: string
  university: string
  wing: string
}

interface Payment {
  id: string
  period_label: string
  amount: number
  status: 'pending' | 'approved' | 'disbursed' | 'rejected'
  remarks: string | null
  internship: {
    area: string
    student: Student
  }
}

interface FinancePaymentActionsProps {
  initialPayments: Payment[]
}

export default function FinancePaymentActions({ initialPayments }: FinancePaymentActionsProps) {
  const [items, setItems] = useState<Payment[]>(initialPayments)
  const [actionId, setActionId] = useState<string | null>(null)
  const [remarks, setRemarks] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // Filter local state
  const [filterStatus, setFilterStatus] = useState<string>('all')

  async function handleStatusUpdate(id: string, status: 'approved' | 'disbursed' | 'rejected') {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/stipend', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: id,
          status,
          remarks: status === 'rejected' ? remarks : undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update payment status')

      setItems(prev => prev.map(item => {
        if (item.id === id) {
          return { ...item, status, remarks: status === 'rejected' ? remarks : item.remarks }
        }
        return item
      }))
      setActionId(null)
      setRemarks('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredItems = items.filter(i => {
    if (filterStatus === 'all') return true
    return i.status === filterStatus
  })

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
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filter Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl p-2 bg-white focus:outline-none focus:border-green-600"
          >
            <option value="all">All Payments</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="disbursed">Disbursed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wider">
                <th className="p-4">Intern Details</th>
                <th className="p-4">Area / Dept</th>
                <th className="p-4">Period</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.map((p) => {
                const isAction = actionId === p.id
                return (
                  <>
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="p-4">
                        <div className="font-semibold text-gray-900">{p.internship?.student?.full_name}</div>
                        <div className="text-[10px] text-gray-400">{p.internship?.student?.university}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-medium text-gray-700">{p.internship?.area} Area</div>
                        <div className="text-[10px] text-gray-400">{p.internship?.student?.wing}</div>
                      </td>
                      <td className="p-4 font-medium text-gray-700">{p.period_label}</td>
                      <td className="p-4 text-right font-bold text-gray-900">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p.amount)}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${statusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {p.status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => { setActionId(p.id); setError(''); }}
                              className="text-xs font-bold text-red-600 hover:text-red-700"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(p.id, 'approved')}
                              className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg hover:bg-green-100 transition-colors"
                            >
                              Approve
                            </button>
                          </div>
                        )}
                        {p.status === 'approved' && (
                          <button
                            onClick={() => handleStatusUpdate(p.id, 'disbursed')}
                            className="text-xs font-bold text-white bg-green-700 px-3 py-1.5 rounded-xl hover:bg-green-800 transition-colors"
                          >
                            Disburse Funds
                          </button>
                        )}
                        {(p.status === 'disbursed' || p.status === 'rejected') && (
                          <span className="text-xs text-gray-400 italic">No action</span>
                        )}
                      </td>
                    </tr>

                    {isAction && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={6} className="p-4 border-t border-b border-gray-100">
                          <div className="space-y-4 max-w-md ml-auto">
                            <div className="space-y-1">
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Rejection Reason / Remarks</label>
                              <input
                                type="text"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter reason for rejecting this payment request..."
                                className="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:border-green-600"
                              />
                            </div>

                            {error && (
                              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
                                {error}
                              </div>
                            )}

                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setActionId(null)}
                                className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(p.id, 'rejected')}
                                disabled={saving}
                                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                {saving ? 'Rejecting...' : 'Confirm Reject'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 italic">
                    No stipend payments matched the filter.
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
