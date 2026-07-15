'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface NoticeRead {
  user_id: string
}

interface Notice {
  id: string
  title: string
  content: string
  created_by: string
  source_area: string
  is_hq_notice: boolean
  target_roles: string[]
  target_areas: string[]
  priority: 'normal' | 'urgent'
  created_at: string
  created_by_profile?: {
    full_name: string
    role: string
  }
  notice_reads?: NoticeRead[]
}

interface NoticeInboxProps {
  initialNotices: Notice[]
  isAdminGlobal: boolean
  currentAdminId: string
}

export default function NoticeInbox({ initialNotices, isAdminGlobal, currentAdminId }: NoticeInboxProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams ? searchParams.get('tab') : null

  const [notices, setNotices] = useState<Notice[]>(initialNotices)
  
  // Tab for area admin: 'hq_inbox' or 'sent_by_me'
  const [activeSubTab, setActiveSubTab] = useState<'hq_inbox' | 'sent_by_me'>(
    isAdminGlobal ? 'sent_by_me' : (tabParam === 'sent' ? 'sent_by_me' : 'hq_inbox')
  )

  useEffect(() => {
    setNotices(initialNotices)
  }, [initialNotices])

  useEffect(() => {
    if (tabParam === 'sent') {
      setActiveSubTab('sent_by_me')
    }
  }, [tabParam])

  // Forwarding state
  const [forwardNotice, setForwardNotice] = useState<Notice | null>(null)
  const [studentChecked, setStudentChecked] = useState<boolean>(true)
  const [mentorChecked, setMentorChecked] = useState<boolean>(true)
  const [employeeChecked, setEmployeeChecked] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // Filter notices list
  const filteredNotices = notices.filter(n => {
    if (isAdminGlobal) {
      // HQ Admin: only shows notices they created
      return n.created_by === currentAdminId
    } else {
      if (activeSubTab === 'hq_inbox') {
        // Area Admin: show notices created by HQ admins targeted to admins
        return n.is_hq_notice === true && n.created_by !== currentAdminId
      } else {
        // Area Admin: show notices they posted/forwarded
        return n.created_by === currentAdminId
      }
    }
  })

  async function handleForward() {
    if (!forwardNotice) return
    const roles: string[] = []
    if (studentChecked) roles.push('student')
    if (mentorChecked) roles.push('mentor')
    if (employeeChecked) roles.push('employee')

    if (roles.length === 0) {
      setError('Please select at least one role to forward to.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: forwardNotice.title,
          content: forwardNotice.content,
          target_roles: roles,
          priority: forwardNotice.priority,
          forwarded_from: forwardNotice.id
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to forward notice')

      // Refresh list
      const listRes = await fetch('/api/notices')
      const listData = await listRes.json()
      if (listRes.ok && listData.data) {
        setNotices(listData.data)
      }
      setForwardNotice(null)
      setActiveSubTab('sent_by_me')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sub Tabs for Area Admins */}
      {!isAdminGlobal && (
        <div className="flex gap-2 border-b border-gray-100 pb-3">
          <button
            onClick={() => setActiveSubTab('hq_inbox')}
            className={`text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${
              activeSubTab === 'hq_inbox' ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Received from HQ Inbox
          </button>
          <button
            onClick={() => setActiveSubTab('sent_by_me')}
            className={`text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${
              activeSubTab === 'sent_by_me' ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            My Area Announcements
          </button>
        </div>
      )}

      {/* Notices Feed */}
      <div className="space-y-4">
        {filteredNotices.map((n) => {
          const isUrgent = n.priority === 'urgent'
          const readCount = n.notice_reads?.length || 0

          return (
            <div
              key={n.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm space-y-3 transition-colors ${
                isUrgent ? 'border-red-200 bg-red-50/10' : 'border-gray-100'
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{n.title}</h3>
                    {isUrgent && (
                      <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                        URGENT
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    Posted on {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · By {n.created_by_profile?.full_name || 'Admin'} ({n.source_area})
                  </span>
                </div>

                {/* Actions / Read receipts */}
                {n.created_by === currentAdminId ? (
                  <span className="text-[10px] bg-gray-50 text-gray-400 border border-gray-100 px-2.5 py-1 rounded-full font-bold">
                    Read by {readCount} users
                  </span>
                ) : (
                  !isAdminGlobal && activeSubTab === 'hq_inbox' && (
                    <button
                      onClick={() => { setForwardNotice(n); setError(''); }}
                      className="text-xs font-bold bg-[#166534] text-white px-3 py-1.5 rounded-xl hover:bg-[#155e2f] transition-colors"
                    >
                      Forward to Area
                    </button>
                  )
                )}
              </div>

              <p className="text-xs text-gray-600 leading-relaxed bg-gray-50/30 p-3 rounded-xl border border-gray-50">
                {n.content}
              </p>

              <div className="flex gap-4 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                <span>Targets: {n.target_roles.join(', ')}</span>
                <span>Areas: {n.target_areas.join(', ')}</span>
              </div>
            </div>
          )
        })}

        {filteredNotices.length === 0 && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center text-gray-400 text-sm italic">
            No notices to display in this feed.
          </div>
        )}
      </div>

      {/* Forward Modal */}
      {forwardNotice && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 max-w-md w-full space-y-4 shadow-xl">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Forward Announcement</h3>
              <p className="text-xs text-gray-500">
                Forward <strong>"{forwardNotice.title}"</strong> to recipients in your training area.
              </p>
            </div>

            <div className="space-y-2 border-t border-b border-gray-100 py-3">
              <span className="block text-xs font-bold uppercase tracking-wider text-gray-400">Select Recipient Roles</span>
              <div className="flex flex-col gap-2 text-xs font-medium text-gray-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={studentChecked}
                    onChange={(e) => setStudentChecked(e.target.checked)}
                    className="rounded border-gray-300 text-green-700 focus:ring-green-600"
                  />
                  Students
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mentorChecked}
                    onChange={(e) => setMentorChecked(e.target.checked)}
                    className="rounded border-gray-300 text-green-700 focus:ring-green-600"
                  />
                  Mentors
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={employeeChecked}
                    onChange={(e) => setEmployeeChecked(e.target.checked)}
                    className="rounded border-gray-300 text-green-700 focus:ring-green-600"
                  />
                  Area Employees
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setForwardNotice(null)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleForward}
                disabled={saving}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? 'Forwarding...' : 'Confirm Forward'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
