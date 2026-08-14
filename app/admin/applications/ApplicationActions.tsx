'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // ── HQ Forward Modal state ──────────────────────────────────────
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [departments, setDepartments] = useState<any[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [deptAvailabilityMap, setDeptAvailabilityMap] = useState<Record<string, string[]>>({})
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedTargetArea, setSelectedTargetArea] = useState('')
  const [forwardLoading, setForwardLoading] = useState(false)
  const [forwardError, setForwardError] = useState('')

  // ── Area Admin Create Account modal state ───────────────────────
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [password, setPassword] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [wing, setWing] = useState('')
  const [areaDepts, setAreaDepts] = useState<any[]>([])
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountError, setAccountError] = useState('')

  // Load data when HQ Forward modal opens
  useEffect(() => {
    if (!showForwardModal) return
    async function loadForwardData() {
      try {
        // Fetch all departments + global availability map (no area filter → full map)
        const res = await fetch(`/api/admin/area-departments?area=Headquarters`)
        const data = await res.json()
        if (res.ok) {
          setDepartments(data.departments || [])
          setDeptAvailabilityMap(data.deptAvailabilityMap || {})
        }
        // Fetch all MCL areas
        const areasRes = await fetch('/api/areas')
        const areasData = await areasRes.json()
        if (areasRes.ok) {
          setAreas((areasData.areas || []).map((a: any) => a.name).filter((n: string) => n !== 'Headquarters'))
        }
      } catch (err) {
        console.error('Error loading forward modal data:', err)
      }
    }
    loadForwardData()
  }, [showForwardModal])

  // Load departments for Area Admin Create Account modal
  useEffect(() => {
    if (!showRegisterForm) return
    async function loadDepts() {
      try {
        const res = await fetch(`/api/admin/area-departments?area=${encodeURIComponent(area || '')}`)
        const data = await res.json()
        if (res.ok) setAreaDepts(data.departments || [])
      } catch (err) {
        console.error('Error fetching area departments:', err)
      }
    }
    loadDepts()
  }, [showRegisterForm, area])

  // Areas where the selected dept is active
  const activeAreasForDept = selectedDept ? (deptAvailabilityMap[selectedDept] || []) : []

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
        if (!res.ok) { setError(data.error || 'Failed to approve'); setLoading(false); return }
        setStatus('approved')
      } catch (err: any) {
        setError(err.message || 'Connection error'); setLoading(false); return
      }
    } else {
      const { error: updateError } = await supabase.from('applications').update({ status: 'rejected' }).eq('id', applicationId)
      if (updateError) { setError(updateError.message); setLoading(false); return }
      setStatus('rejected')
    }
    setLoading(false)
    router.refresh()
  }

  async function handleForwardToArea(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTargetArea) { setForwardError('Please select a target area.'); return }
    setForwardLoading(true)
    setForwardError('')
    try {
      // Update application status to pending_area only (wing col does not exist on applications)
      const { error: appErr } = await supabase
        .from('applications')
        .update({ status: 'pending_area' })
        .eq('id', applicationId)

      if (appErr) throw appErr

      // If student profile exists, update area and wing there
      if (studentId) {
        const profileUpdate: any = { area: selectedTargetArea }
        if (selectedDept) profileUpdate.wing = selectedDept
        await supabase.from('profiles').update(profileUpdate).eq('id', studentId)
        await supabase.from('internships').update({ area: selectedTargetArea, is_active: false }).eq('student_id', studentId)
      }

      setShowForwardModal(false)
      setStatus('pending_area')
      router.refresh()
    } catch (err: any) {
      setForwardError(err.message || 'Failed to forward application.')
    }
    setForwardLoading(false)
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
      if (!res.ok || data.error) { setAccountError(data.error || 'Failed to create account'); setAccountLoading(false); return }
      setShowRegisterForm(false)
      router.refresh()
    } catch (err: any) {
      setAccountError(err.message || 'Connection error')
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
      <div className="flex gap-2 flex-wrap">
        {lorUrl && (
          <a href={lorUrl} target="_blank" rel="noopener noreferrer"
            className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 font-medium transition-colors">
            View LoR
          </a>
        )}

        {showActions && (
          isAdminGlobal ? (
            <>
              <button
                onClick={() => { setShowForwardModal(true); setForwardError(''); setSelectedDept(''); setSelectedTargetArea('') }}
                disabled={loading}
                className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm transition-colors"
              >
                Forward to Area
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

      {/* ── HQ Admin: Forward to Area Modal ─────────────────────── */}
      {showForwardModal && mounted && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-gray-100 shadow-2xl text-gray-900 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>📨</span> Forward Application to Area
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select the student&apos;s department from their LoR and route to the correct Area Admin
                </p>
              </div>
              <button onClick={() => setShowForwardModal(false)}
                className="text-gray-400 hover:text-gray-600 w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 text-sm font-bold flex-shrink-0">
                ✕
              </button>
            </div>

            {/* Candidate Summary */}
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 text-xs space-y-1.5">
              <p className="font-bold text-gray-900 text-sm">{studentName}</p>
              <div className="flex flex-wrap gap-3 text-gray-500">
                <span>📧 {studentEmail}</span>
                {rollNo && <span>🎓 {rollNo}</span>}
                {university && <span>🏛️ {university}</span>}
              </div>
              {lorUrl && (
                <a href={lorUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold underline text-[11px] mt-1">
                  <span>📄</span> View Employee Submitted LoR ↗
                </a>
              )}
            </div>

            <form onSubmit={handleForwardToArea} className="space-y-4">
              {/* Step 1: Select Department */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Step 1 — Select Student&apos;s Department / Wing
                  <span className="text-gray-400 ml-1 font-normal normal-case">(read from their LoR)</span>
                </label>
                <select
                  value={selectedDept}
                  onChange={e => { setSelectedDept(e.target.value); setSelectedTargetArea('') }}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                >
                  <option value="">-- Select Department from LoR --</option>
                  {departments.map(dept => (
                    <option key={dept.id || dept.name} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Active areas for selected dept */}
              {selectedDept && (
                <div className="animate-in fade-in duration-200">
                  {activeAreasForDept.length > 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-800 mb-3">
                      <p className="font-bold flex items-center gap-1.5 mb-1">
                        <span>✅</span> &quot;{selectedDept}&quot; is active in:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeAreasForDept.map(a => (
                          <span key={a} className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[11px] font-bold">{a}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 mb-3">
                      <p className="font-medium flex items-center gap-1.5">
                        <span>⚠️</span> No area has this department configured yet. You can still forward to any area.
                      </p>
                    </div>
                  )}

                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Step 2 — Select Target Area
                    {activeAreasForDept.length > 0 && <span className="text-emerald-600 ml-1 font-normal normal-case">(highlighted areas recommended)</span>}
                  </label>
                  <select
                    value={selectedTargetArea}
                    onChange={e => setSelectedTargetArea(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    required
                  >
                    <option value="">-- Select Target Area --</option>
                    {areas.map(areaName => {
                      const isRecommended = activeAreasForDept.includes(areaName)
                      return (
                        <option key={areaName} value={areaName}>
                          {isRecommended ? '✅ ' : ''}{areaName} Area{isRecommended ? ' (Recommended)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              {forwardError && (
                <p className="text-red-500 text-xs font-medium bg-red-50 px-3 py-2 rounded-lg">{forwardError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForwardModal(false)} disabled={forwardLoading}
                  className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={forwardLoading || !selectedDept || !selectedTargetArea}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5">
                  {forwardLoading ? 'Forwarding...' : <><span>📨</span> Forward to {selectedTargetArea || 'Area'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Area Admin: Create Student Account Modal ─────────────── */}
      {showRegisterForm && mounted && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-100 shadow-xl text-gray-900 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">Create Student Account</h3>
            <p className="text-xs text-gray-500">
              Register <strong>{studentName}</strong>. Credentials will be sent to <strong>{studentEmail}</strong>.
            </p>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Temporary Password</label>
                <input type="text" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-900"
                  placeholder="TempPassword@123" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-900" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-900" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Wing / Department</label>
                <select value={wing} onChange={e => setWing(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-900 font-medium">
                  <option value="">-- Select Wing / Department --</option>
                  {areaDepts.map(dept => (
                    <option key={dept.id || dept.name} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>

              {accountError && <p className="text-red-500 text-xs font-medium">{accountError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRegisterForm(false)} disabled={accountLoading}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={accountLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                  {accountLoading ? 'Creating...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
