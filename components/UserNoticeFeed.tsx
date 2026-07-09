'use client'
import { useState } from 'react'

interface Notice {
  id: string
  title: string
  content: string
  source_area: string
  priority: 'normal' | 'urgent'
  created_at: string
  created_by_profile?: {
    full_name: string
  }
  notice_reads: { user_id: string }[]
}

interface UserNoticeFeedProps {
  initialNotices: Notice[]
  currentUserId: string
}

export default function UserNoticeFeed({ initialNotices, currentUserId }: UserNoticeFeedProps) {
  const [notices, setNotices] = useState<Notice[]>(initialNotices)

  async function handleMarkRead(id: string) {
    try {
      const res = await fetch('/api/notices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notice_id: id })
      })
      if (res.ok) {
        setNotices(prev => prev.map(n => {
          if (n.id === id) {
            // Add user to read list if not already there
            const alreadyRead = n.notice_reads.some(r => r.user_id === currentUserId)
            return {
              ...n,
              notice_reads: alreadyRead ? n.notice_reads : [...n.notice_reads, { user_id: currentUserId }]
            }
          }
          return n
        }))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Sort: urgent first, then by date descending
  const sorted = [...notices].sort((a, b) => {
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1
    if (a.priority !== 'urgent' && b.priority === 'urgent') return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Count unread
  const unreadCount = notices.filter(n => !n.notice_reads.some(r => r.user_id === currentUserId)).length

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-lg font-bold text-gray-900">Announcements Feed</h2>
        {unreadCount > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-extrabold px-2.5 py-1 rounded-full animate-pulse">
            {unreadCount} New Notice{unreadCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {sorted.map((n) => {
          const isUrgent = n.priority === 'urgent'
          const isRead = n.notice_reads.some(r => r.user_id === currentUserId)

          return (
            <div
              key={n.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm space-y-3 transition-all relative overflow-hidden ${
                isUrgent ? 'border-red-200 bg-red-50/5' : 'border-gray-100'
              } ${!isRead ? 'ring-1 ring-green-600/30' : ''}`}
            >
              {/* Unread dot */}
              {!isRead && (
                <div className="absolute top-0 left-0 w-1.5 h-full bg-green-600" />
              )}

              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{n.title}</h3>
                    {isUrgent && (
                      <span className="text-[9px] bg-red-150 text-red-700 font-bold px-1.5 py-0.5 rounded">
                        URGENT
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · By {n.created_by_profile?.full_name || 'Admin'} ({n.source_area})
                  </span>
                </div>

                {!isRead && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="text-xs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-xl hover:bg-green-100 transition-colors"
                  >
                    Mark as Read
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-600 leading-relaxed bg-gray-50/30 p-3 rounded-xl border border-gray-50">
                {n.content}
              </p>
            </div>
          )
        })}

        {sorted.length === 0 && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center text-gray-400 text-sm italic">
            No notices posted for your area yet.
          </div>
        )}
      </div>
    </div>
  )
}
