'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function InternActions({
  internshipId, studentId, studentName, isActive
}: {
  internshipId: string
  studentId: string
  studentName: string
  isActive: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(isActive)
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
      router.refresh()
    }
    setLoading(false)
  }

  async function deleteStudent() {
    const confirmDelete = window.confirm(
      `Warning: Are you sure you want to permanently delete student "${studentName}"?\n\nThis will permanently delete their account, profile, attendance logs, and assignment submissions from the database.`
    )
    if (!confirmDelete) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, internshipId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to delete student')
      } else {
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during deletion')
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap items-center">
        <button onClick={toggleAccess} disabled={loading}
          className={`px-2 py-1 text-xs rounded-lg disabled:opacity-50 ${
            active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
          }`}>
          {active ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={deleteStudent}
          disabled={loading}
          className="px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
