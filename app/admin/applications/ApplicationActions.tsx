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
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountError, setAccountError] = useState('')

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
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-100 shadow-xl relative text-gray-900">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Create Student Account</h3>
            <p className="text-xs text-gray-500 mb-4">
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
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Wing / Department (Optional)</label>
                <input
                  type="text"
                  value={wing}
                  onChange={e => setWing(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-900"
                  placeholder="Excavation / Mining / HRD"
                />
              </div>

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
                  disabled={accountLoading}
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
    </div>
  )
}
