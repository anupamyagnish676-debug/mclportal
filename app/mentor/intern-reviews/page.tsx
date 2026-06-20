'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MentorInternReviewsPage() {
  const supabase = createClient()
  const [interns, setInterns] = useState<any[]>([])
  const [selectedInternship, setSelectedInternship] = useState('')
  const [logbooks, setLogbooks] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [submittingLeaveId, setSubmittingLeaveId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Fetch assigned interns
      const { data: assigned, error: intErr } = await supabase
        .from('internships')
        .select('id, student_id, student:profiles!internships_student_id_fkey(full_name)')
        .eq('mentor_id', user.id)

      if (intErr) {
        setError(intErr.message)
        setLoading(false)
        return
      }

      setInterns(assigned || [])
      if (assigned?.length) {
        setSelectedInternship(assigned[0].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedInternship) return
    async function loadReviews() {
      // Load Logbooks
      const { data: logs } = await supabase
        .from('logbooks')
        .select('*')
        .eq('internship_id', selectedInternship)
        .order('date', { ascending: false })
      setLogbooks(logs || [])

      // Load Leaves
      const { data: leaveRequests } = await supabase
        .from('leaves')
        .select('*')
        .eq('internship_id', selectedInternship)
        .order('created_at', { ascending: false })
      setLeaves(leaveRequests || [])
    }
    loadReviews()
  }, [selectedInternship])

  async function handleLeaveStatus(leaveId: string, newStatus: 'approved' | 'rejected') {
    setSubmittingLeaveId(leaveId)
    const { error: updateErr } = await supabase
      .from('leaves')
      .update({ status: newStatus })
      .eq('id', leaveId)

    if (updateErr) {
      setError(updateErr.message)
    } else {
      // Refresh local state list
      setLeaves(leaves.map(l => l.id === leaveId ? { ...l, status: newStatus } : l))
    }
    setSubmittingLeaveId(null)
  }

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading intern review dashboard...</div>
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Intern Reviews</h1>
      <p className="text-gray-500 text-sm mb-6">Monitor daily logbooks and manage leave applications of your assigned interns.</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {!interns.length ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
          No interns assigned to you yet.
        </div>
      ) : (
        <>
          {/* Intern selector */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Selected Intern:</label>
            <select
              value={selectedInternship}
              onChange={e => setSelectedInternship(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {interns.map(i => (
                <option key={i.id} value={i.id}>
                  {i.student?.full_name || 'Unknown Student'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Leaves Section */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>✉️</span> Leave Applications
              </h2>

              {!leaves.length ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No leave requests submitted by this intern.
                </div>
              ) : (
                <div className="space-y-4">
                  {leaves.map(leave => {
                    const days = Math.round((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
                    return (
                      <div key={leave.id} className="p-4 border border-gray-100 rounded-xl space-y-2 bg-gray-50/50">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {new Date(leave.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(leave.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <span className="text-[10px] text-gray-500 font-medium">
                              ({days} {days === 1 ? 'day' : 'days'})
                            </span>
                          </div>
                          
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold capitalize
                            ${leave.status === 'approved' ? 'bg-green-50 text-green-700' : 
                              leave.status === 'rejected' ? 'bg-red-50 text-red-700' : 
                              'bg-yellow-50 text-yellow-700'}`}>
                            {leave.status}
                          </span>
                        </div>

                        <p className="text-xs text-gray-600 italic">
                          " {leave.reason} "
                        </p>

                        {leave.status === 'pending' && (
                          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100/50">
                            <button
                              onClick={() => handleLeaveStatus(leave.id, 'rejected')}
                              disabled={submittingLeaveId !== null}
                              className="px-2.5 py-1 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleLeaveStatus(leave.id, 'approved')}
                              disabled={submittingLeaveId !== null}
                              className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Logbook Section */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>📔</span> Daily Logbook Entries
              </h2>

              {!logbooks.length ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No logbook entries submitted by this intern.
                </div>
              ) : (
                <div className="relative border-l border-gray-100 pl-4 ml-2 space-y-5 max-h-[500px] overflow-y-auto pr-1">
                  {logbooks.map(log => (
                    <div key={log.id} className="relative">
                      <div className="absolute -left-[21px] mt-1.5 w-3 h-3 rounded-full bg-green-600 border-2 border-white ring-4 ring-green-50" />
                      <div>
                        <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full">
                          {new Date(log.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <p className="mt-2 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {log.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
