'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ApplicationActions({
  applicationId, studentId, studentEmail, studentName, lorUrl, currentStatus
}: {
  applicationId: string
  studentId: string
  studentEmail: string
  studentName: string
  lorUrl: string
  currentStatus: string
}) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleAction(action: 'approved' | 'rejected') {
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase.from('applications').update({ status: action }).eq('id', applicationId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setStatus(action)

    if (action === 'approved') {
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'joining_letter', to: studentEmail, studentName }),
        })
      } catch {
        // email failure shouldn't block the approval itself
      }
    }
    setLoading(false)
  }

  if (status !== 'pending') {
    return <span className="text-gray-400 text-xs">No actions</span>
  }

  return (
    <div>
      <div className="flex gap-2">
        {lorUrl && (
          <a href={lorUrl} target="_blank" rel="noopener noreferrer"
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            View LoR
          </a>
        )}
        <button onClick={() => handleAction('approved')} disabled={loading}
          className="px-2 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
          Approve
        </button>
        <button onClick={() => handleAction('rejected')} disabled={loading}
          className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
          Reject
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
