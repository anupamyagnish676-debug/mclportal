'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function IssueActions({
  internshipId,
  studentName,
  studentEmail,
  hasCertificate,
  certificateUrl,
  mentorApproved
}: {
  internshipId: string
  studentName: string
  studentEmail: string
  hasCertificate: boolean
  certificateUrl: string | null
  mentorApproved: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function issueCertificate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/generate-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internshipId, studentName, studentEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to generate certificate')
      } else {
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during certificate generation')
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap items-center">
        {!hasCertificate ? (
          mentorApproved ? (
            <button
              onClick={issueCertificate}
              disabled={loading}
              className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Issuing...' : 'Issue Certificate'}
            </button>
          ) : (
            <span className="px-2.5 py-1 text-xs bg-amber-50 border border-amber-200 text-amber-600 rounded-lg font-medium" title="Mentor must approve in settings before certificate can be issued">
              ⏳ Awaiting Mentor Approval
            </span>
          )
        ) : (
          <div className="flex gap-2 items-center">
            <span className="px-2.5 py-1 text-xs bg-green-50 border border-green-200 text-green-600 rounded-lg font-medium">
              Issued ✓
            </span>
            {certificateUrl && (
              <a
                href={certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 text-xs border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-lg transition-colors"
              >
                View PDF
              </a>
            )}
            <button
              onClick={issueCertificate}
              disabled={loading}
              className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? 'Re-issuing...' : 'Re-issue'}
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
    </div>
  )
}
