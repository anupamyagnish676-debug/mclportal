'use client'
import { useState, useEffect } from 'react'

export default function AnnouncementBannerControl() {
  const [message, setMessage] = useState('')
  const [type, setType] = useState<'warning' | 'info' | 'critical'>('info')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    async function loadCurrent() {
      try {
        const res = await fetch('/api/admin/announcement-banner')
        const data = await res.json()
        if (res.ok && data.banner) {
          setMessage(data.banner.message || '')
          setType(data.banner.type || 'info')
          setIsActive(Boolean(data.banner.isActive))
        }
      } catch (e: any) {
        console.error('Failed to load banner config:', e)
      }
    }
    loadCurrent()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    setMsg('')

    try {
      const res = await fetch('/api/admin/announcement-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, type, isActive }),
      })

      const data = await res.json()
      if (res.ok) {
        setMsg('Site-wide announcement banner updated! Saved to Google Drive & live across all dashboards.')
        setTimeout(() => setMsg(''), 4000)
      } else {
        setErr(data.error || 'Failed to update banner')
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <span>📢 Site-Wide Urgent Announcement Banner</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Broadcast a dynamic floating alert banner at the top of all user dashboards (Student, Mentor, Admin, Finance, Employee).
          </p>
        </div>

        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
          📁 HQ Drive Saved
        </span>
      </div>

      {err && <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200 font-medium">{err}</div>}
      {msg && <div className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-xl border border-emerald-200 font-medium">{msg}</div>}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Banner Announcement Text</label>
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. Portal Maintenance scheduled tonight at 10 PM. Please save logbooks."
              className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Banner Alert Style</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="info">📢 Info Notice (Emerald Green)</option>
              <option value="warning">⚠️ Warning Alert (Amber Gold)</option>
              <option value="critical">🚨 Critical Alert (Crimson Red)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span>Show Announcement Banner Live on All Dashboards</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors shadow-md disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Publish Site Announcement'}
          </button>
        </div>
      </form>
    </div>
  )
}
