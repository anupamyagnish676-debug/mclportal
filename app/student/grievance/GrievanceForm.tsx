'use client'
import { useState } from 'react'

interface Grievance {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_review' | 'resolved'
  admin_response: string | null
  created_at: string
  resolved_at: string | null
}

interface GrievanceFormProps {
  initialGrievances: Grievance[]
}

export default function GrievanceForm({ initialGrievances }: GrievanceFormProps) {
  const [grievances, setGrievances] = useState<Grievance[]>(initialGrievances)
  const [subject, setSubject] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<boolean>(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject || !description) {
      setError('Please fill in both subject and description.')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/grievance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, description })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit grievance')

      setSubject('')
      setDescription('')
      setSuccess(true)

      // Fetch updated list of grievances
      const listRes = await fetch('/api/grievance')
      const listData = await listRes.json()
      if (listRes.ok && listData.data) {
        setGrievances(listData.data)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Submit Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">File a New Grievance / Complaint</h2>
          <p className="text-xs text-gray-500">Your concerns will be sent directly to the Admin HRD and kept strictly confidential from mentors.</p>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief subject of your complaint..."
            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Detailed description of your issue, incident, or support requested..."
            className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 text-xs p-3 rounded-xl">
            Grievance submitted successfully. The admin team will review it shortly.
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-[#166534] hover:bg-[#155e2f] text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'File Grievance'}
        </button>
      </form>

      {/* History List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 px-1">My Filed Grievances</h2>
        <div className="space-y-4">
          {grievances.map((g) => {
            const isResolved = g.status === 'resolved'
            const isReview = g.status === 'in_review'

            return (
              <div key={g.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{g.subject}</h3>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Submitted on {new Date(g.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                      isResolved
                        ? 'bg-green-50 text-green-700 border border-green-150/50'
                        : isReview
                        ? 'bg-blue-50 text-blue-700 border border-blue-150/50'
                        : 'bg-amber-50 text-amber-700 border border-amber-150/50'
                    }`}
                  >
                    {g.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50/50 p-3 rounded-xl border border-gray-50">
                  {g.description}
                </p>

                {g.admin_response && (
                  <div className="bg-green-50/20 p-4 rounded-xl border border-green-100/50 space-y-1">
                    <p className="text-[10px] font-bold text-[#166534] uppercase tracking-wider">Admin Redressal Response</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{g.admin_response}</p>
                    {g.resolved_at && (
                      <span className="text-[9px] text-gray-400 block mt-1">
                        Resolved at: {new Date(g.resolved_at).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {grievances.length === 0 && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center text-gray-400 text-sm italic">
              You have not filed any grievances yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
