'use client'
import { useState } from 'react'

interface Student {
  full_name: string
  area: string
  university: string
}

interface Grievance {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_review' | 'resolved'
  admin_response: string | null
  created_at: string
  student: Student
}

interface GrievancePanelProps {
  initialGrievances: Grievance[]
}

export default function GrievancePanel({ initialGrievances }: GrievancePanelProps) {
  const [items, setItems] = useState<Grievance[]>(initialGrievances)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [status, setStatus] = useState<'open' | 'in_review' | 'resolved'>('open')
  const [response, setResponse] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  function handleToggle(g: Grievance) {
    if (expandedId === g.id) {
      setExpandedId(null)
    } else {
      setExpandedId(g.id)
      setStatus(g.status)
      setResponse(g.admin_response || '')
      setError('')
    }
  }

  async function handleSave(id: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/grievance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grievance_id: id,
          status,
          admin_response: response
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update grievance')

      // Update state local copy
      setItems(prev => prev.map(item => {
        if (item.id === id) {
          return { ...item, status, admin_response: response }
        }
        return item
      }))
      setExpandedId(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wider">
              <th className="p-4">Student Info</th>
              <th className="p-4">Subject</th>
              <th className="p-4">Status</th>
              <th className="p-4">Date Filed</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((g) => {
              const isExpanded = expandedId === g.id
              return (
                <>
                  <tr key={g.id} className="hover:bg-gray-50/50">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{g.student?.full_name || 'N/A'}</div>
                      <div className="text-[10px] text-gray-400">{g.student?.university} · {g.student?.area} Area</div>
                    </td>
                    <td className="p-4 font-medium text-gray-700">{g.subject}</td>
                    <td className="p-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                          g.status === 'resolved'
                            ? 'bg-green-50 text-green-700 border border-green-150/50'
                            : g.status === 'in_review'
                            ? 'bg-blue-50 text-blue-700 border border-blue-150/50'
                            : 'bg-amber-50 text-amber-700 border border-amber-150/50'
                        }`}
                      >
                        {g.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-gray-400">
                      {new Date(g.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggle(g)}
                        className="text-xs font-semibold text-green-600 hover:text-green-700"
                      >
                        {isExpanded ? 'Collapse' : 'Review & Action'}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={5} className="p-5 border-t border-b border-gray-100">
                        <div className="space-y-4 max-w-3xl">
                          <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Grievance Description</p>
                            <p className="text-xs text-gray-700 bg-white p-4 rounded-xl border border-gray-150 leading-relaxed shadow-sm">
                              {g.description}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Update Status</label>
                              <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                                className="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                              >
                                <option value="open">Open</option>
                                <option value="in_review">In Review</option>
                                <option value="resolved">Resolved</option>
                              </select>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Redressal Action Response (Sends Email to Student)</label>
                              <textarea
                                value={response}
                                onChange={(e) => setResponse(e.target.value)}
                                rows={3}
                                placeholder="Explain resolution actions taken, status of inquiry, etc..."
                                className="w-full text-xs border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-600"
                              />
                            </div>
                          </div>

                          {error && (
                            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
                              {error}
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setExpandedId(null)}
                              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSave(g.id)}
                              disabled={saving}
                              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {saving ? 'Saving...' : 'Save Resolution'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                  No grievances currently registered.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
