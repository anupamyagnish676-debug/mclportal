'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ApplicationActions({
  applicationId, 
  studentId, 
  studentEmail, 
  studentName, 
  lorUrl, 
  currentStatus,
  isAdminGlobal
}: {
  applicationId: string
  studentId: string | null
  studentEmail: string
  studentName: string
  lorUrl: string
  currentStatus: string
  isAdminGlobal: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [error, setError] = useState('')
  const supabase = createClient()

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

  const showActions = isAdminGlobal 
    ? (status === 'pending_hq' || status === 'pending')
    : (status === 'pending_area')

  if (!showActions) {
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
        {isAdminGlobal ? (
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
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}
    </div>
  )
}
