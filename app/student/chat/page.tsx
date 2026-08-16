'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function StudentChatPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<any[]>([])
  const [mentorName, setMentorName] = useState<string>('Assigned Mentor')
  const [inputMsg, setInputMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  async function loadData() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Fetch student internship to get mentor name
        const { data: internship } = await supabase
          .from('internships')
          .select('mentor:profiles!internships_mentor_id_fkey(full_name)')
          .eq('student_id', user.id)
          .maybeSingle()

        if (internship?.mentor) {
          const mObj = Array.isArray(internship.mentor) ? internship.mentor[0] : internship.mentor
          if (mObj?.full_name) setMentorName(mObj.full_name)
        }
      }

      const res = await fetch('/api/mentor/chat')
      const data = await res.json()
      if (res.ok) {
        setMessages(data.messages || [])
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000) // Polling every 10 seconds for new messages
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!inputMsg.trim()) return

    setSending(true)
    setErr('')
    try {
      const res = await fetch('/api/mentor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: inputMsg.trim() })
      })

      const data = await res.json()
      if (res.ok) {
        setInputMsg('')
        loadData()
      } else {
        setErr(data.error || 'Failed to send message')
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-4">
      
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-base">
            👨‍🏫
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base">{mentorName}</h1>
            <p className="text-xs text-emerald-700 font-medium">● Assigned Mentor (Private Chat)</p>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-bold bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
          📁 Saved to Area Google Drive
        </div>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs font-medium">
          {err}
        </div>
      )}

      {/* Messages Thread Container */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 h-[460px] overflow-y-auto space-y-4 shadow-inner">
        {loading && !messages.length ? (
          <div className="text-center py-20 text-slate-400 text-sm">Loading chat history from Google Drive...</div>
        ) : !messages.length ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            No messages yet. Send a message to start chatting with your mentor!
          </div>
        ) : (
          messages.map(m => {
            const isMe = m.senderRole === 'student'
            return (
              <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-slate-400 mb-1 px-1 font-bold">
                  {m.senderName} ({m.senderRole === 'student' ? 'You' : 'Mentor'})
                </span>
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-xs ${
                    isMe
                      ? 'bg-emerald-700 text-white rounded-br-none'
                      : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  {m.content}
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send Box */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={inputMsg}
          onChange={e => setInputMsg(e.target.value)}
          placeholder="Type your message to your mentor..."
          className="flex-1 border border-slate-200 bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
        />
        <button
          type="submit"
          disabled={sending || !inputMsg.trim()}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-md disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send Message'}
        </button>
      </form>

    </div>
  )
}
