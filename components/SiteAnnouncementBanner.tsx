'use client'
import { useState, useEffect } from 'react'

export default function SiteAnnouncementBanner() {
  const [banner, setBanner] = useState<{
    message: string
    type: 'warning' | 'info' | 'critical'
    isActive: boolean
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    async function loadBanner() {
      try {
        const res = await fetch('/api/admin/announcement-banner')
        const data = await res.json()
        if (res.ok && data.banner) {
          setBanner(data.banner)
        }
      } catch (e) {
        console.error('Failed to load announcement banner:', e)
      }
    }
    loadBanner()
  }, [])

  if (dismissed || !banner || !banner.isActive || !banner.message.trim()) {
    return null
  }

  const themeStyles = {
    critical: 'bg-red-600 text-white border-red-700 shadow-red-900/20',
    warning: 'bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-amber-900/20',
    info: 'bg-emerald-700 text-white border-emerald-800 shadow-emerald-900/20',
  }[banner.type] || 'bg-emerald-700 text-white'

  const icons = {
    critical: '🚨',
    warning: '⚠️',
    info: '📢',
  }[banner.type] || '📢'

  return (
    <div className={`w-full px-4 py-2.5 mb-6 rounded-2xl border shadow-md flex items-center justify-between gap-4 transition-all animate-fadeIn ${themeStyles}`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl flex-shrink-0">{icons}</span>
        <div className="text-xs md:text-sm font-semibold leading-snug truncate">
          <span className="uppercase tracking-wider font-extrabold mr-2 opacity-90">[Notice]:</span>
          {banner.message}
        </div>
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-black/15 hover:bg-black/25 transition-colors flex-shrink-0"
        title="Dismiss announcement"
      >
        ✕
      </button>
    </div>
  )
}
