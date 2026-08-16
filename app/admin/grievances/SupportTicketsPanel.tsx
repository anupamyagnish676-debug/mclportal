'use client'
import { useState, useEffect } from 'react'

export default function SupportTicketsPanel({
  userArea,
  isHqAdmin,
  areas
}: {
  userArea: string
  isHqAdmin: boolean
  areas: any[]
}) {
  const [selectedArea, setSelectedArea] = useState(userArea || 'Headquarters')
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [resolutionText, setResolutionText] = useState<Record<string, string>>({})
  const [statusSelect, setStatusSelect] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function loadTickets(areaToFetch: string) {
    try {
      setLoading(true)
      const res = await fetch(`/api/support/tickets?area=${encodeURIComponent(areaToFetch)}`)
      const data = await res.json()
      if (res.ok) {
        setTickets(data.tickets || [])
        const notesMap: Record<string, string> = {}
        const statusMap: Record<string, string> = {}
        ;(data.tickets || []).forEach((t: any) => {
          notesMap[t.id] = t.resolutionNotes || ''
          statusMap[t.id] = t.status || 'open'
        })
        setResolutionText(notesMap)
        setStatusSelect(statusMap)
      } else {
        setErr(data.error || 'Failed to load tickets from Google Drive')
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets(selectedArea)
  }, [selectedArea])

  const getCleanAreaLabel = (name: string) => {
    if (!name) return ''
    if (name === 'all' || name === 'All Areas') return '🌐 All Areas (Global)'
    if (name === 'Headquarters') return 'Headquarters (Central)'
    if (name.endsWith(' Area')) return name
    return `${name} Area`
  }

  async function handleUpdateTicket(ticket: any) {
    setUpdatingId(ticket.id)
    setErr('')
    setMsg('')

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          area: selectedArea,
          targetTicketArea: ticket.area,
          status: statusSelect[ticket.id],
          resolutionNotes: resolutionText[ticket.id] || '',
        })
      })

      const data = await res.json()
      if (res.ok) {
        setMsg(`Ticket ${ticket.id} updated successfully! Saved to Google Drive.`)
        setTimeout(() => setMsg(''), 3000)
        loadTickets(selectedArea)
      } else {
        setErr(data.error || 'Failed to update ticket')
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredTickets = tickets.filter(t => {
    if (filterStatus === 'all') return true
    return t.status === filterStatus
  })

  return (
    <div className="space-y-6">

      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isHqAdmin && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mr-2">Area:</label>
              <select
                value={selectedArea}
                onChange={e => setSelectedArea(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">🌐 All Areas (Global)</option>
                {areas.map(a => (
                  <option key={a.name} value={a.name}>
                    {getCleanAreaLabel(a.name)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mr-2">Status:</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Tickets</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
          📁 Area Drive: {selectedArea} / Helpdesk_Tickets
        </div>
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

      {/* Tickets List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
          Loading support tickets from Area Google Drive...
        </div>
      ) : !filteredTickets.length ? (
        <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
          No support tickets found for this area.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">{t.id}</span>
                    <span className="text-xs font-bold text-slate-900">{t.studentName}</span>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">{t.category}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mt-1">{t.subject}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusSelect[t.id] || t.status}
                    onChange={e => setStatusSelect({ ...statusSelect, [t.id]: e.target.value })}
                    className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="open">● Open</option>
                    <option value="in_progress">⚙ In Progress</option>
                    <option value="resolved">✓ Resolved</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {t.description}
              </div>

              {/* Attachment */}
              {t.attachmentUrl && (
                <div>
                  <a
                    href={t.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
                  >
                    📎 Open Attachment from Google Drive
                  </a>
                </div>
              )}

              {/* Resolution Form */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-600 uppercase">Admin Resolution & Response</label>
                <textarea
                  value={resolutionText[t.id] || ''}
                  onChange={e => setResolutionText({ ...resolutionText, [t.id]: e.target.value })}
                  rows={2}
                  placeholder="Enter response or resolution details for the intern..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={() => handleUpdateTicket(t)}
                  disabled={updatingId === t.id}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {updatingId === t.id ? 'Updating GDrive...' : 'Save Resolution & Update Ticket'}
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  )
}
