'use client'
import { useState } from 'react'

interface ExtensionRequest {
  id: string
  requested_end_date: string
  reason: string
  mentor_status: 'pending' | 'approved' | 'rejected'
  mentor_remarks: string | null
  admin_status: 'pending' | 'approved' | 'rejected'
  admin_remarks: string | null
}

interface ExtensionFormProps {
  currentEndDate: string
  existingRequest?: ExtensionRequest
}

export default function ExtensionForm({ currentEndDate, existingRequest }: ExtensionFormProps) {
  const [requestedEndDate, setRequestedEndDate] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<boolean>(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!requestedEndDate || !reason) {
      setError('Please select a requested end date and provide a reason.')
      return
    }

    const current = new Date(currentEndDate)
    const requested = new Date(requestedEndDate)
    if (requested <= current) {
      setError('The requested end date must be after your current end date.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/extension-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_end_date: requestedEndDate,
          reason
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit extension request')

      setSuccess(true)
      window.location.reload() // Reload to fetch fresh state
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // If there's an existing request, show status card
  if (existingRequest) {
    const isFullyApproved = existingRequest.mentor_status === 'approved' && existingRequest.admin_status === 'approved'
    const isRejected = existingRequest.mentor_status === 'rejected' || existingRequest.admin_status === 'rejected'
    const isMentorPending = existingRequest.mentor_status === 'pending'
    const isAdminPending = existingRequest.mentor_status === 'approved' && existingRequest.admin_status === 'pending'

    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Current Extension Request</h2>

        <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50/50 p-4 rounded-xl border border-gray-50">
          <div>
            <p className="text-gray-400 font-bold uppercase tracking-wider">Requested End Date</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{existingRequest.requested_end_date}</p>
          </div>
          <div>
            <p className="text-gray-400 font-bold uppercase tracking-wider">Reason</p>
            <p className="text-sm text-gray-700 mt-1">{existingRequest.reason}</p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {/* Mentor Status */}
          <div className="flex items-center justify-between text-xs border-b border-gray-50 pb-2">
            <div>
              <span className="font-semibold text-gray-800">Project Mentor Status</span>
              {existingRequest.mentor_remarks && (
                <p className="text-[10px] text-gray-400 italic mt-0.5">Remarks: {existingRequest.mentor_remarks}</p>
              )}
            </div>
            <span className={`px-2 py-0.5 rounded font-bold capitalize ${
              existingRequest.mentor_status === 'approved' ? 'bg-green-50 text-green-700' :
              existingRequest.mentor_status === 'rejected' ? 'bg-red-50 text-red-700' :
              'bg-amber-50 text-amber-700'
            }`}>
              {existingRequest.mentor_status}
            </span>
          </div>

          {/* Admin Status */}
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-gray-800">HRD Admin Status</span>
              {existingRequest.admin_remarks && (
                <p className="text-[10px] text-gray-400 italic mt-0.5">Remarks: {existingRequest.admin_remarks}</p>
              )}
            </div>
            <span className={`px-2 py-0.5 rounded font-bold capitalize ${
              existingRequest.admin_status === 'approved' ? 'bg-green-50 text-green-700' :
              existingRequest.admin_status === 'rejected' ? 'bg-red-50 text-red-700' :
              'bg-amber-50 text-amber-700'
            }`}>
              {existingRequest.admin_status}
            </span>
          </div>
        </div>

        {isRejected && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-red-500 mb-3">Your previous request was rejected. You may submit a new one below.</p>
            <button
              onClick={() => {
                // Clear existing request by reloading page (usually you would clear it in parent but let's just make it simple)
                window.location.reload()
              }}
              className="text-xs font-semibold text-green-600 hover:underline"
            >
              Submit New Request
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Request Internship Extension</h2>
        <p className="text-xs text-gray-500">Request to extend your training end date. Requires approval from both your Mentor and HRD Admin.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Current End Date</label>
          <input
            type="text"
            disabled
            value={currentEndDate}
            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-500 font-semibold"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Requested End Date</label>
          <input
            type="date"
            value={requestedEndDate}
            onChange={(e) => setRequestedEndDate(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Reason for Extension</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Briefly explain the academic or project completion reason for requested extension..."
          className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-600"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 text-xs p-3 rounded-xl">
          Extension request submitted successfully!
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 bg-[#166534] hover:bg-[#155e2f] text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
      >
        {submitting ? 'Submitting Request...' : 'Submit Extension Request'}
      </button>
    </form>
  )
}
