'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Intern = {
  id: string
  student_id: string
  start_date: string
  end_date: string
  is_active: boolean
  certificate_approved: boolean
  certificate_url: string | null
  student: { full_name: string; email: string } | null
}

type Stats = {
  totalDays: number
  presentDays: number
  totalAssignments: number
  submittedAssignments: number
}

export default function ApproveCertificatePage() {
  const supabase = createClient()
  const [interns, setInterns] = useState<Intern[]>([])
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    loadInterns()
  }, [])

  async function loadInterns() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('internships')
      .select('id, student_id, start_date, end_date, is_active, certificate_approved, certificate_url, student:profiles!internships_student_id_fkey(full_name, email)')
      .eq('mentor_id', user.id)
      .order('is_active', { ascending: false })

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }

    setInterns(data || [])

    // Fetch stats for each intern
    const statsMap: Record<string, Stats> = {}
    for (const intern of (data || [])) {
      // Attendance stats
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('internship_id', intern.id)

      const totalDays = attendance?.length || 0
      const presentDays = attendance?.filter(a => a.status === 'present' || a.status === 'half-day').length || 0

      // Assignment stats
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id')
        .eq('internship_id', intern.id)

      const totalAssignments = assignments?.length || 0

      // Submission stats
      let submittedAssignments = 0
      if (totalAssignments > 0) {
        const assignmentIds = assignments!.map(a => a.id)
        const { data: submissions } = await supabase
          .from('submissions')
          .select('assignment_id')
          .eq('student_id', intern.student_id)
          .in('assignment_id', assignmentIds)

        submittedAssignments = submissions?.length || 0
      }

      statsMap[intern.id] = { totalDays, presentDays, totalAssignments, submittedAssignments }
    }

    setStats(statsMap)
    setLoading(false)
  }

  async function handleApprove(internshipId: string) {
    setSaving(internshipId)
    setMessage({ type: '', text: '' })

    const { error } = await supabase
      .from('internships')
      .update({ certificate_approved: true })
      .eq('id', internshipId)

    setSaving(null)

    if (error) {
      setMessage({ type: 'error', text: `Failed: ${error.message}` })
    } else {
      setMessage({ type: 'success', text: 'Certificate approved! Admin can now issue it.' })
      setInterns(prev => prev.map(i => i.id === internshipId ? { ...i, certificate_approved: true } : i))
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 4000)
  }

  async function handleRevoke(internshipId: string) {
    setSaving(internshipId)
    setMessage({ type: '', text: '' })

    const { error } = await supabase
      .from('internships')
      .update({ certificate_approved: false })
      .eq('id', internshipId)

    setSaving(null)

    if (error) {
      setMessage({ type: 'error', text: `Failed: ${error.message}` })
    } else {
      setMessage({ type: 'success', text: 'Approval revoked.' })
      setInterns(prev => prev.map(i => i.id === internshipId ? { ...i, certificate_approved: false } : i))
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 4000)
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Approve Certificate</h1>
        <p className="text-gray-500 text-sm mb-8">Review intern progress and approve for certificate issuance</p>
        <div className="text-gray-400 text-sm">Loading interns...</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Approve Certificate</h1>
      <p className="text-gray-500 text-sm mb-8">Review intern progress and approve for certificate issuance</p>

      {message.text && (
        <div className={`px-4 py-3 rounded-lg text-sm mb-4 border ${
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {message.text}
        </div>
      )}

      {interns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
          No interns assigned to you yet.
        </div>
      ) : (
        <div className="space-y-4">
          {interns.map(intern => {
            const s = stats[intern.id] || { totalDays: 0, presentDays: 0, totalAssignments: 0, submittedAssignments: 0 }
            const attendancePct = s.totalDays > 0 ? Math.round((s.presentDays / s.totalDays) * 100) : 0

            return (
              <div key={intern.id} className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{intern.student?.full_name || '—'}</h3>
                    <p className="text-xs text-gray-400">{intern.student?.email}</p>
                    <p className="text-xs text-gray-400 mt-1">{intern.start_date} → {intern.end_date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {intern.certificate_url ? (
                      <span className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-lg font-medium">Certificate Issued ✓</span>
                    ) : intern.certificate_approved ? (
                      <span className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg font-medium">Approved ✓</span>
                    ) : (
                      <span className="px-3 py-1 text-xs bg-yellow-50 text-yellow-600 rounded-lg font-medium">Pending Approval</span>
                    )}
                    {!intern.is_active && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-lg">Inactive</span>
                    )}
                  </div>
                </div>

                {/* Progress Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Attendance</p>
                    <p className="text-lg font-bold text-gray-900">{attendancePct}%</p>
                    <p className="text-xs text-gray-400">{s.presentDays}/{s.totalDays} days</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Assignments</p>
                    <p className="text-lg font-bold text-gray-900">{s.submittedAssignments}/{s.totalAssignments}</p>
                    <p className="text-xs text-gray-400">submitted</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Period</p>
                    <p className="text-sm font-semibold text-gray-900">{intern.start_date}</p>
                    <p className="text-xs text-gray-400">to {intern.end_date}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Status</p>
                    <p className="text-sm font-semibold text-gray-900">{intern.is_active ? 'Active' : 'Completed'}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                {!intern.certificate_url && (
                  <div className="flex gap-2">
                    {!intern.certificate_approved ? (
                      <button
                        onClick={() => handleApprove(intern.id)}
                        disabled={saving === intern.id}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving === intern.id ? 'Saving...' : '✓ Approve for Certificate'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRevoke(intern.id)}
                        disabled={saving === intern.id}
                        className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {saving === intern.id ? 'Saving...' : 'Revoke Approval'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
