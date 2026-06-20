'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function InternActions({
  internshipId, studentEmail, studentName, isActive, hasCertificate, mentorApproved
}: {
  internshipId: string
  studentEmail: string
  studentName: string
  isActive: boolean
  hasCertificate: boolean
  mentorApproved: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(isActive)
  const [certIssued, setCertIssued] = useState(hasCertificate)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function toggleAccess() {
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase
      .from('internships')
      .update({ is_active: !active })
      .eq('id', internshipId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setActive(!active)
    }
    setLoading(false)
  }

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
        setCertIssued(true)
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={toggleAccess} disabled={loading}
          className={`px-2 py-1 text-xs rounded-lg disabled:opacity-50 ${
            active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
          }`}>
          {active ? 'Deactivate' : 'Activate'}
        </button>
        {!certIssued ? (
          mentorApproved ? (
            <button onClick={issueCertificate} disabled={loading}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg disabled:opacity-50">
              {loading ? 'Working...' : 'Issue Cert'}
            </button>
          ) : (
            <span className="px-2 py-1 text-xs bg-yellow-50 text-yellow-600 rounded-lg" title="Mentor must approve before certificate can be issued">
              ⏳ Awaiting Mentor Approval
            </span>
          )
        ) : (
          <span className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-lg">Cert Issued ✓</span>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
