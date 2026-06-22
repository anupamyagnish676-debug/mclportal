'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Internship = {
  id: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  mentor_id: string | null
  area: string | null
  student: { full_name: string; email: string } | null
  mentor: { full_name: string } | null
}

type Mentor = {
  id: string
  full_name: string
  email: string
  area: string | null
}

export default function AssignMentorForm({
  internships,
  mentors,
  isAdminGlobal,
  selectedArea,
  areas = [],
}: {
  internships: Internship[]
  mentors: Mentor[]
  isAdminGlobal: boolean
  selectedArea: string
  areas?: { name: string }[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    internships.forEach(i => {
      if (i.mentor_id) init[i.id] = i.mentor_id
    })
    return init
  })

  async function handleAssign(internshipId: string) {
    const mentorId = selections[internshipId]
    if (!mentorId) {
      setError('Please select a mentor first.')
      setTimeout(() => setError(null), 3000)
      return
    }

    setSaving(internshipId)
    setError(null)
    setSuccess(null)

    const { error: updateError } = await supabase
      .from('internships')
      .update({ mentor_id: mentorId })
      .eq('id', internshipId)

    setSaving(null)

    if (updateError) {
      setError(`Failed to assign: ${updateError.message}`)
      setTimeout(() => setError(null), 5000)
    } else {
      const mentor = mentors.find(m => m.id === mentorId)
      setSuccess(`Mentor "${mentor?.full_name}" assigned successfully!`)
      setTimeout(() => setSuccess(null), 3000)
      router.refresh()
    }
  }

  async function handleUnassign(internshipId: string) {
    setSaving(internshipId)
    setError(null)
    setSuccess(null)

    const { error: updateError } = await supabase
      .from('internships')
      .update({ mentor_id: null })
      .eq('id', internshipId)

    setSaving(null)

    if (updateError) {
      setError(`Failed to unassign: ${updateError.message}`)
      setTimeout(() => setError(null), 5000)
    } else {
      setSelections(prev => {
        const next = { ...prev }
        delete next[internshipId]
        return next
      })
      setSuccess('Mentor unassigned.')
      setTimeout(() => setSuccess(null), 3000)
      router.refresh()
    }
  }

  return (
    <div>
      {/* Global Area Filter Dropdown */}
      {isAdminGlobal && (
        <div className="mb-6 flex justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Filter by Training Office:</span>
            <select
              value={selectedArea}
              onChange={e => {
                const area = e.target.value
                if (area) {
                  router.push(`/admin/assign-mentor?area=${area}`)
                } else {
                  router.push('/admin/assign-mentor')
                }
              }}
              className="border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-gray-700 font-semibold cursor-pointer shadow-sm"
            >
              <option value="">All Offices / Areas</option>
              {areas.map(a => (
                <option key={a.name} value={a.name}>
                  {a.name === 'Headquarters' ? 'Headquarters (Central)' : `${a.name} Area`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Student</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Training Area</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Period</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Current Mentor</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Assign Mentor</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {internships.map(intern => (
              <tr key={intern.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{intern.student?.full_name || '—'}</p>
                  <p className="text-xs text-gray-400">{intern.student?.email || ''}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 font-medium">
                  {intern.area ? `${intern.area} Area` : 'General'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {intern.start_date && intern.end_date
                    ? `${intern.start_date} → ${intern.end_date}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    intern.is_active
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {intern.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {intern.mentor?.full_name ? (
                    <span className="text-gray-900 font-medium">{intern.mentor.full_name}</span>
                  ) : (
                    <span className="text-red-500 text-xs font-medium">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {mentors.length === 0 ? (
                    <span className="text-gray-400 text-xs italic">No mentors available in this area</span>
                  ) : (
                    <select
                      value={selections[intern.id] || ''}
                      onChange={e => setSelections(prev => ({ ...prev, [intern.id]: e.target.value }))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent w-full max-w-[200px]"
                    >
                      <option value="">Select mentor...</option>
                      {mentors.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.email})
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAssign(intern.id)}
                      disabled={saving === intern.id || !selections[intern.id] || mentors.length === 0}
                      className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving === intern.id ? 'Saving...' : 'Assign'}
                    </button>
                    {intern.mentor_id && (
                      <button
                        onClick={() => handleUnassign(intern.id)}
                        disabled={saving === intern.id}
                        className="border border-gray-250 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {internships.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            {selectedArea 
              ? `No internships found in ${selectedArea} Area.`
              : 'No internships found.'
            }
          </div>
        )}
      </div>
    </div>
  )
}
