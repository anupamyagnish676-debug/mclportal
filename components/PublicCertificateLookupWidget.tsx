'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react'

export default function PublicCertificateLookupWidget() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const clean = query.trim()
    if (!clean) return

    setLoading(true)
    // Extract numeric serial or reference token
    const serialMatch = clean.match(/(\d+)/)
    const serial = serialMatch ? serialMatch[1] : clean

    router.push(`/verify/${encodeURIComponent(serial)}`)
  }

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-emerald-100 p-6 shadow-xl space-y-4">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
        <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center font-bold text-lg border border-emerald-200/50 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Public Certificate Verification</h3>
          <p className="text-[11px] text-slate-500">Verify official MCL internship certificates & credentials in real-time</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Certificate Serial No. or Student ID
          </label>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. MCL/HRD/INT/101 or 101"
              className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900 bg-slate-50/50"
              required
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{loading ? 'Searching Record...' : 'Verify Certificate Authenticity'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> QR Code Authenticated</span>
        <span>MCL HRD Department</span>
      </div>
    </div>
  )
}
