'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import HelpAndSupportSection from '@/components/HelpAndSupportSection'

export default function StudentSupportPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [category, setCategory] = useState('Document Re-upload Request')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function loadTickets() {
    try {
      setLoading(true)
      const res = await fetch('/api/support/tickets')
      const data = await res.json()
      if (res.ok) {
        setTickets(data.tickets || [])
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) return

    setSubmitting(true)
    setErr('')
    setMsg('')

    try {
      const formData = new FormData()
      formData.append('category', category)
      formData.append('subject', subject.trim())
      formData.append('description', description.trim())
      if (file) formData.append('file', file)

      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok) {
        setMsg(`Ticket ${data.ticket?.id || ''} submitted to Area Admin (Saved to Google Drive)!`)
        setSubject('')
        setDescription('')
        setFile(null)
        loadTickets()
      } else {
        setErr(data.error || 'Failed to submit ticket')
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">✓ Resolved</span>
      case 'in_progress':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">⚙ In Progress</span>
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">● Open</span>
    }
  }

  return (
    <div className="max-w-4xl pb-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Helpdesk & Support Center</h1>
        <p className="text-slate-500 text-sm">
          Log technical issues, document re-upload requests, or stipend queries to your Area Admin.
        </p>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          {err}
        </div>
      )}

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium">
          {msg}
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-6">

        {/* Form: Raise New Ticket */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <span>🎫 Raise Support Ticket</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Document Re-upload Request">Document Re-upload Request</option>
                <option value="Stipend & Bank Query">Stipend & Bank Query</option>
                <option value="Logbook & Attendance Issue">Logbook & Attendance Issue</option>
                <option value="Certificate Correction">Certificate Correction</option>
                <option value="General Technical Support">General Technical Support</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Brief summary of issue"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe your issue or request in detail..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Attachment (Optional)</label>
              <input
                type="file"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-md disabled:opacity-50"
            >
              {submitting ? 'Submitting to GDrive...' : 'Submit Ticket'}
            </button>
          </form>
        </div>

        {/* List: Existing Tickets */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-900 text-base flex items-center justify-between">
            <span>📋 My Support Tickets</span>
            <span className="text-xs font-normal text-slate-500">Stored in Area GDrive</span>
          </h2>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading tickets from Google Drive...</div>
          ) : !tickets.length ? (
            <div className="py-12 text-center text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
              No tickets raised yet.
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map(t => (
                <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{t.id}</span>
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">{t.category}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mt-1">{t.subject}</h3>
                    </div>
                    {getStatusBadge(t.status)}
                  </div>

                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-lg border border-slate-150">
                    {t.description}
                  </p>

                  {t.attachmentUrl && (
                    <div>
                      <a
                        href={t.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                      >
                        📎 View Attached Screenshot / Document
                      </a>
                    </div>
                  )}

                  {t.resolutionNotes && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs space-y-1">
                      <p className="font-bold text-emerald-900">Area Admin Response:</p>
                      <p className="text-emerald-800 whitespace-pre-wrap">{t.resolutionNotes}</p>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 flex justify-between pt-1">
                    <span>Raised: {new Date(t.createdAt).toLocaleString('en-IN')}</span>
                    <span>Area: {t.area}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <HelpAndSupportSection role="student" />
    </div>
  )
}
