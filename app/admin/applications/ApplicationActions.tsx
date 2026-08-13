'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ShiftAreaModal from '@/components/ShiftAreaModal'

export default function ApplicationActions({
  applicationId, 
  studentId, 
  studentEmail, 
  studentName, 
  lorUrl, 
  currentStatus,
  isAdminGlobal,
  rollNo,
  university,
  area
}: {
  applicationId: string
  studentId: string | null
  studentEmail: string
  studentName: string
  lorUrl: string
  currentStatus: string
  isAdminGlobal: boolean
  rollNo?: string | null
  university?: string | null
  area?: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [error, setError] = useState('')
  const supabase = createClient()
  
  // Mounted state for React Portal rendering on client-side only
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Form states for creating student account
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [password, setPassword] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [wing, setWing] = useState('')
  const [departments, setDepartments] = useState<any[]>([])
  const [deptAvailabilityMap, setDeptAvailabilityMap] = useState<Record<string, string[]>>({})
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountError, setAccountError] = useState('')

  // Shift Area Modal state for forwarding candidate when wing is inactive
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [shiftCandidate, setShiftCandidate] = useState<any>(null)

  useEffect(() => {
    if (!showRegisterForm) return
    async function loadDepts() {
      try {
        const res = await fetch(`/api/admin/area-departments?area=${encodeURIComponent(area || '')}`)
        const data = await res.json()
        if (res.ok) {
          setDepartments(data.departments || [])
          setDeptAvailabilityMap(data.deptAvailabilityMap || {})
        }
      } catch (err) {
        console.error('Error fetching area departments:', err)
      }
    }
    loadDepts()
  }, [showRegisterForm, area])

  const activeAreasForWing = wing ? (deptAvailabilityMap[wing] || []) : []
  const isWingActiveInCurrentArea = wing ? (activeAreasForWing.length === 0 || activeAreasForWing.includes(area || '')) : true

  async function handleAction(action: 'approved' | 'rejected') {
    setLoading(true)
    setError('')

    if (action === 'approved') {
      try {
        const res = await fetch('/api/applications/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to approve application')
          setLoading(false)
          return
        }

        setStatus('approved')
      } catch (err: any) {
        setError(err.message || 'Connection error during approval')
        setLoading(false)
        return
      }
    } else {
      // Rejection updates status directly
      const { error: updateError } = await supabase
        .from('applications')
        .update({ status: 'rejected' })
        .eq('id', applicationId)

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      setStatus('rejected')
    }

    setLoading(false)
    router.refresh()
  }

  async function handleForward() {
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase
      .from('applications')
      .update({ status: 'pending_area' })
      .eq('id', applicationId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setStatus('pending_area')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setAccountLoading(true)
    setAccountError('')

    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: studentName,
          email: studentEmail,
          password,
          role: 'student',
          wing: wing || null,
          start_date: startDate,
          end_date: endDate,
          roll_no: rollNo || null,
          university: university || null,
          area: area || null,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setAccountError(data.error || 'Failed to create student account')
        setAccountLoading(false)
        return
      }

      setShowRegisterForm(false)
      router.refresh()
    } catch (err: any) {
      setAccountError(err.message || 'Connection error during account creation')
    }
    setAccountLoading(false)
  }

  const showActions = isAdminGlobal 
    ? (status === 'pending_hq' || status === 'pending')
    : (status === 'pending_area')

  const canCreateAccount = !isAdminGlobal && status === 'approved' && !studentId

  if (!showActions && !canCreateAccount) {
    return <span className="text-gray-400 text-xs font-semibold">No actions</span>
  }

  return (
    <div>
      <div className="flex gap-2">
        {lorUrl && (
          <a href={lorUrl} target="_blank" rel="noopener noreferrer"
            className="px-2.5 py-1 text-xs border border-gray-250 rounded-lg hover:bg-gray-50 text-gray-600 font-medium transition-colors">
            View LoR
          </a>
        )}
        {showActions && (
          isAdminGlobal ? (
            <>
              <button onClick={handleForward} disabled={loading}
                className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm transition-colors">
                {loading ? 'Routing...' : 'Forward to Area'}
              </button>
              <button onClick={() => handleAction('rejected')} disabled={loading}
                className="px-2.5 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold shadow-sm transition-colors">
                Reject
              </button>
            </>
          ) : (
            <>
              <button onClick={() => handleAction('approved')} disabled={loading}
                className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold shadow-sm transition-colors">
                {loading ? 'Approving...' : 'Approve'}
              </button>
              <button onClick={() => handleAction('rejected')} disabled={loading}
                className="px-2.5 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold shadow-sm transition-colors">
                Reject
              </button>
            </>
          )
        )}
        {canCreateAccount && (
          <button onClick={() => setShowRegisterForm(true)}
            className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold shadow-sm transition-colors">
            Create Student Account
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}

      {/* Account Registration Modal via React Portal */}
      {showRegisterForm && mounted && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-100 shadow-xl relative text-gray-900 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Create Student Account</h3>
            <p className="text-xs text-gray-500 mb-2">
              Register <strong>{studentName}</strong> and configure their training schedule. Credentials and reporting letter details will be sent to <strong>{studentEmail}</strong>.
            </p>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Temporary Password</label>
                <input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-900"
                  placeholder="TempPassword@123"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Wing / Department</label>
                <select
                  value={wing}
                  onChange={e => setWing(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-900 font-medium"
                >
                  <option value="">-- Select Wing / Department --</option>
                  {departments.map(dept => {
                    const activeAreas = deptAvailabilityMap[dept.name] || []
                    const isActiveInArea = activeAreas.length === 0 || activeAreas.includes(area || '')

                    return (
                      <option key={dept.id || dept.name} value={dept.name}>
                        {dept.name} {isActiveInArea 
                          ? `⭐ (Active in ${area || 'Area'})` 
                          : `🔒 (Not Active in ${area || 'Area'}${activeAreas.length > 0 ? ` — Active in: ${activeAreas.join(', ')}` : ''})`
                        }
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Smart Department Inactive Alert & LoR Forwarding Button */}
              {wing && !isWingActiveInCurrentArea && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 space-y-2 animate-in fade-in duration-200">
                  <p className="font-bold flex items-center gap-1.5 text-amber-950 text-xs">
                    <span>⚠️</span> Department &quot;{wing}&quot; is NOT active in {area || 'this'} Area.
                  </p>
                  {activeAreasForWing.length > 0 ? (
                    <p className="text-[11px] text-emerald-800 font-medium">
                      ✅ Active &amp; Operational in: <span className="underline font-bold">{activeAreasForWing.join(', ')}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-500 italic">No Area has enabled this department yet.</p>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterForm(false)
                      setShiftCandidate({
                        id: studentId || '',
                        full_name: studentName,
                        email: studentEmail,
                        wing: wing,
                        area: area || 'Talcher',
                        roll_no: rollNo,
                        university: university
                      })
                      setShiftModalOpen(true)
                    }}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 mt-1"
                  >
                    <span>📄</span> Attach LoR &amp; Send to Active Area Modal ↗
                  </button>
                </div>
              )}

              {accountError && (
                <p className="text-red-500 text-xs font-medium">{accountError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterForm(false)}
                  disabled={accountLoading}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={accountLoading || (Boolean(wing) && !isWingActiveInCurrentArea)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {accountLoading ? 'Creating...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Shift Area Modal with LoR Upload for Forwarding Candidate */}
      <ShiftAreaModal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        student={shiftCandidate}
        onSuccess={() => {
          router.refresh()
        }}
      />
    </div>
  )
}
