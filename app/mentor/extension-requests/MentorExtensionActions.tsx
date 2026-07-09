'use client'
import { useState } from 'react'

interface Student {
  full_name: string
  university: string
}

interface Request {
  id: string
  requested_end_date: string
  reason: string
  mentor_status: 'pending' | 'approved' | 'rejected'
  mentor_remarks: string | null
  student: Student
}

interface MentorExtensionActionsProps {
  initialRequests: Request[]
}

export default function MentorExtensionActions({ initialRequests }: MentorExtensionActionsProps) {
  const [items, setItems] = useState<Request[]>(initialRequests)
  const [actionId, setActionId] = useState<string | null>(null)
  const [remarks, setRemarks] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  async function handleAction(id: string, status: 'approved' | 'rejected') {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/extension-request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: id,
          mentor_status: status,
          mentor_remarks: remarks
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update request')

      setItems(prev => prev.map(item => {
        if (item.id === id) {
          return { ...item, mentor_status: status, mentor_remarks: remarks }
        }
        return item
      }))
      setActionId(null)
      setRemarks('')
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
              <th className="p-4">Student</th>
              <th className="p-4">Requested End Date</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((r) => {
              const isAction = actionId === r.id
              return (
                <>
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{r.student.full_name}</div>
                      <div className="text-[10px] text-gray-400">{r.student.university}</div>
                    </td>
                    <td className="p-4 font-semibold text-green-700">{r.requested_end_date}</td>
                    <td className="p-4 text-xs text-gray-600 max-w-xs truncate">{r.reason}</td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                        r.mentor_status === 'approved' ? 'bg-green-50 text-green-700' :
                        r.mentor_status === 'rejected' ? 'bg-red-50 text-red-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {r.mentor_status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {r.mentor_status === 'pending' ? (
                        <button
                          onClick={() => { setActionId(r.id); setError(''); }}
                          className="text-xs font-semibold text-green-600 hover:text-green-700"
                        >
                          Review Request
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Reviewed</span>
                      )}
                    </td>
                  </tr>

                  {isAction && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={5} className="p-5 border-t border-b border-gray-100">
                        <div className="space-y-4 max-w-2xl">
                          <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Reason for Extension</p>
                            <p className="text-xs text-gray-700 bg-white p-3 rounded-xl border border-gray-150">
                              "{r.reason}"
                            </p>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Remarks / Comments</label>
                            <input
                              type="text"
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                              placeholder="Remarks to justify approval or rejection..."
                              className="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:border-green-600"
                            />
                          </div>

                          {error && (
                            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
                              {error}
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setActionId(null)}
                              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleAction(r.id, 'rejected')}
                              disabled={saving}
                              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold transition-colors"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleAction(r.id, 'approved')}
                              disabled={saving}
                              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs font-semibold transition-colors"
                            >
                              Approve
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
                  No pending extension requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
