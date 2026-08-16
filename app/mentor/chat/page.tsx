'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MentorChatPage() {
  const supabase = createClient()
  const [interns, setInterns] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [loadingInterns, setLoadingInterns] = useState(true)
  const [loadingChat, setLoadingChat] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  async function loadAssignedInterns() {
    try {
      setLoadingInterns(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: list } = await supabase
        .from('internships')
        .select('id, serial_no, student_id, student:profiles!internships_student_id_fkey(id, full_name, email, area)')
        .eq('mentor_id', user.id)

      const formatted = (list || []).map((item: any) => {
        const sObj = Array.isArray(item.student) ? item.student[0] : item.student
        return {
          internshipId: item.id,
          serialNo: item.serial_no,
          studentId: item.student_id,
          fullName: sObj?.full_name || 'Student',
          email: sObj?.email || '',
          area: sObj?.area || 'Headquarters'
        }
      })

      setInterns(formatted)
      if (formatted.length > 0) {
        setSelectedStudent(formatted[0])
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoadingInterns(false)
    }
  }

  async function loadChat(studentId: string) {
    if (!studentId) return
    try {
      setLoadingChat(true)
      const res = await fetch(`/api/mentor/chat?studentId=${studentId}`)
      const data = await res.json()
      if (res.ok) {
        setMessages(data.messages || [])
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoadingChat(false)
    }
  }

  useEffect(() => {
    loadAssignedInterns()
  }, [])

  useEffect(() => {
    if (selectedStudent) {
      loadChat(selectedStudent.studentId)
      const interval = setInterval(() => loadChat(selectedStudent.studentId), 10000)
      return () => clearInterval(interval)
    }
  }, [selectedStudent])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!inputMsg.trim() || !selectedStudent) return

    setSending(true)
    setErr('')
    try {
      const res = await fetch('/api/mentor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: inputMsg.trim(),
          targetStudentId: selectedStudent.studentId,
        })
      })

      const data = await res.json()
      if (res.ok) {
        setInputMsg('')
        loadChat(selectedStudent.studentId)
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
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Mentor Intern Direct Messaging</h1>
        <p className="text-sm text-slate-500">
          Chat 1-on-1 with your assigned interns. All chat threads are saved directly into Area Google Drive.
        </p>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs font-medium">
          {err}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">

        {/* Sidebar: Assigned Interns */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <h2 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
            👨‍🎓 Assigned Interns ({interns.length})
          </h2>

          {loadingInterns ? (
            <div className="py-8 text-center text-slate-400 text-xs">Loading interns...</div>
          ) : !interns.length ? (
            <div className="py-8 text-center text-slate-400 text-xs">No interns assigned to you yet.</div>
          ) : (
            <div className="space-y-2">
              {interns.map(i => {
                const isSelected = selectedStudent?.studentId === i.studentId
                return (
                  <button
                    key={i.studentId}
                    onClick={() => setSelectedStudent(i)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold shadow-xs'
                        : 'bg-white border-slate-150 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{i.fullName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{i.serialNo || ''}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-normal mt-0.5 truncate">{i.email}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Main: Chat Thread View */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4 flex flex-col justify-between">
          
          {/* Header */}
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                {selectedStudent ? selectedStudent.fullName : 'Select an intern'}
              </h2>
              <p className="text-xs text-slate-400">
                {selectedStudent ? `${selectedStudent.email} • ${selectedStudent.area}` : 'Choose from the left list to view conversation'}
              </p>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
              📁 Area GDrive Saved
            </span>
          </div>

          {/* Messages Body */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 h-[380px] overflow-y-auto space-y-3 shadow-inner">
            {loadingChat ? (
              <div className="text-center py-16 text-slate-400 text-xs">Loading chat history from Google Drive...</div>
            ) : !selectedStudent ? (
              <div className="text-center py-16 text-slate-400 text-xs">Select an intern to view messages.</div>
            ) : !messages.length ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No chat history found. Send a message to start conversation!
              </div>
            ) : (
              messages.map(m => {
                const isMe = m.senderRole === 'mentor'
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-400 mb-0.5 px-1 font-bold">
                      {m.senderName} ({m.senderRole === 'mentor' ? 'You' : 'Intern'})
                    </span>
                    <div
                      className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-emerald-700 text-white rounded-br-none'
                          : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      {m.content}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <form onSubmit={handleSend} className="flex gap-2 pt-2">
            <input
              type="text"
              value={inputMsg}
              onChange={e => setInputMsg(e.target.value)}
              disabled={!selectedStudent}
              placeholder={selectedStudent ? `Reply to ${selectedStudent.fullName}...` : 'Select intern first'}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={sending || !inputMsg.trim() || !selectedStudent}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors shadow-md disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>

        </div>

      </div>
    </div>
  )
}
