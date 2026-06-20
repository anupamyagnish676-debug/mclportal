'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function StudentLeavesPage() {
  const supabase = createClient()
  const [internship, setInternship] = useState<any>(null)
  const [leaves, setLeaves] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Fetch internship
      const { data: intern, error: intErr } = await supabase
        .from('internships')
        .select('id, start_date, end_date')
        .eq('student_id', user.id)
        .maybeSingle()

      if (intErr) {
        setError(intErr.message)
        setLoading(false)
        return
      }

      if (intern) {
        setInternship(intern)
        // Fetch leaves
        const { data: leavesList, error: leavesErr } = await supabase
          .from('leaves')
          .select('*')
          .eq('internship_id', intern.id)
          .order('created_at', { ascending: false })

        if (leavesErr) {
          setError(leavesErr.message)
        } else {
          setLeaves(leavesList || [])
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleApplyLeave(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate || !reason.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      setError('Start date cannot be after end date.')
      setSaving(false)
      return
    }

    if (internship) {
      const internStart = new Date(internship.start_date)
      const internEnd = new Date(internship.end_date)
      if (start < internStart || end > internEnd) {
        setError(`Leave dates must fall within your internship period (${internship.start_date} to ${internship.end_date}).`)
        setSaving(false)
        return
      }
    }

    const { error: insertErr } = await supabase
      .from('leaves')
      .insert({
        internship_id: internship.id,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        status: 'pending'
      })

    if (insertErr) {
      setError(insertErr.message)
    } else {
      setSuccess('Leave application submitted successfully! Your mentor will review it.')
      setStartDate('')
      setEndDate('')
      setReason('')
      // Refresh list
      const { data: leavesList } = await supabase
        .from('leaves')
        .select('*')
        .eq('internship_id', internship.id)
        .order('created_at', { ascending: false })
      setLeaves(leavesList || [])
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading leave applications...</div>
  }

  if (!internship) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
        No active internship record found. Please contact the administrator.
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Leave Application</h1>
      <p className="text-gray-500 text-sm mb-6">Apply for leave and view the approval status of your submissions.</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
          {success}
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-6">
        {/* Leave application form */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Apply for Leave</h2>
            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    min={internship.start_date}
                    max={internship.end_date}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">To Date</label>
                  <input
                    type="date"
                    value={endDate}
                    min={internship.start_date}
                    max={internship.end_date}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reason for Leave</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Provide a brief explanation for your absence request..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving || !startDate || !endDate || !reason.trim()}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Submitting request...' : 'Submit Leave Request'}
              </button>
            </form>
          </div>
        </div>

        {/* Applied Leaves History */}
        <div className="md:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Leave Application History</h2>
            
            {!leaves.length ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No leave requests submitted yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Duration</th>
                      <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Reason</th>
                      <th className="py-3 text-xs font-bold text-gray-400 tracking-wider text-right uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {leaves.map(leave => {
                      const days = Math.round((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
                      return (
                        <tr key={leave.id}>
                          <td className="py-3.5">
                            <p className="text-sm font-semibold text-gray-900">
                              {new Date(leave.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(leave.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                              {days} {days === 1 ? 'day' : 'days'}
                            </span>
                          </td>
                          <td className="py-3.5 max-w-xs">
                            <p className="text-xs text-gray-600 truncate" title={leave.reason}>{leave.reason}</p>
                          </td>
                          <td className="py-3.5 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize
                              ${leave.status === 'approved' ? 'bg-green-50 text-green-700' : 
                                leave.status === 'rejected' ? 'bg-red-50 text-red-700' : 
                                'bg-yellow-50 text-yellow-700'}`}>
                              {leave.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
