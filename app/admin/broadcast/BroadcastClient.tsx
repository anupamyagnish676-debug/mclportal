'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Send, CheckCircle2, AlertCircle, Loader2,
  Users, Eye, EyeOff, RefreshCw, Lock
} from 'lucide-react'

const ALL_ROLES = [
  { value: 'student',  label: 'Interns / Students',  color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { value: 'mentor',   label: 'Mentors',              color: 'bg-purple-50 text-purple-700 border-purple-100' },
  { value: 'employee', label: 'Employees',            color: 'bg-orange-50 text-orange-700 border-orange-100' },
  { value: 'finance',  label: 'Finance Officers',     color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  { value: 'admin',    label: 'Admins',               color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
]

const ALL_AREAS = ['Headquarters', 'Talcher', 'Jagannath', 'Lingaraj', 'Subhadra']

type Result  = { sent: number; failed: number; total: number; errors: string[] }
type Preview = { count: number; preview: { name: string; email: string; role: string; area: string }[] }

interface Props {
  isHQ: boolean
  adminArea: string
}

export default function BroadcastClient({ isHQ, adminArea }: Props) {
  const [subject, setSubject]           = useState('')
  const [message, setMessage]           = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['all'])
  // Area is fixed for area admins — only HQ can change it
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    isHQ ? ['all'] : [adminArea]
  )
  const [loading, setLoading]           = useState(false)
  const [result, setResult]             = useState<Result | null>(null)
  const [error, setError]               = useState('')
  const [confirmed, setConfirmed]       = useState(false)
  const [preview, setPreview]           = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showPreview, setShowPreview]   = useState(false)

  // Live recipient count
  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const roles = selectedRoles.join(',')
      const areas = selectedAreas.join(',')
      const res = await fetch(`/api/admin/broadcast-email?roles=${roles}&areas=${areas}`)
      const data = await res.json()
      setPreview(data)
    } catch {}
    setPreviewLoading(false)
  }, [selectedRoles, selectedAreas])

  useEffect(() => { fetchPreview() }, [fetchPreview])

  function toggleRole(role: string) {
    if (role === 'all') {
      setSelectedRoles(['all'])
    } else {
      const without = selectedRoles.filter(r => r !== 'all' && r !== role)
      const adding  = !selectedRoles.includes(role)
      const next    = adding ? [...without, role] : without
      setSelectedRoles(next.length ? next : ['all'])
    }
  }

  function toggleArea(area: string) {
    if (area === 'all') {
      setSelectedAreas(['all'])
    } else {
      const without = selectedAreas.filter(a => a !== 'all' && a !== area)
      const adding  = !selectedAreas.includes(area)
      const next    = adding ? [...without, area] : without
      setSelectedAreas(next.length ? next : ['all'])
    }
  }

  async function handleSend() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, roles: selectedRoles, areas: selectedAreas }),
      })
      const data = await res.json()
      if (!res.ok || data.error) setError(data.error || 'Failed to send emails')
      else setResult(data)
    } catch (e: any) {
      setError(e.message || 'Network error')
    }
    setLoading(false)
  }

  const canSend = subject.trim() && message.trim() && confirmed && !loading

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Compose & Broadcast Email</h1>
        <p className="text-gray-500 text-sm">
          Write a custom message and send it to selected users
          {!isHQ && (
            <span className="ml-2 inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 text-xs font-semibold px-2 py-0.5 rounded-full">
              <Lock className="w-2.5 h-2.5" />
              {adminArea} Area only
            </span>
          )}
        </p>
      </div>

      {!result ? (
        <div className="space-y-4">

          {/* ── TO: Recipients ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">To: Recipients</p>

            {/* Role filter */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium">Filter by Role</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleRole('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    selectedRoles.includes('all')
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  All Roles
                </button>
                {ALL_ROLES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => toggleRole(r.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      selectedRoles.includes(r.value) && !selectedRoles.includes('all')
                        ? r.color
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Area filter — HQ sees all options, area admins see locked badge */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium">Filter by Area</p>

              {isHQ ? (
                /* HQ: full area selector */
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleArea('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      selectedAreas.includes('all')
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    All Areas
                  </button>
                  {ALL_AREAS.map(a => (
                    <button
                      key={a}
                      onClick={() => toggleArea(a)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        selectedAreas.includes(a) && !selectedAreas.includes('all')
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              ) : (
                /* Area admin: locked to their area */
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">{adminArea} Area</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      You can only send emails to users in your area.
                      Contact HQ Admin to broadcast across all areas.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Live recipient count */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                {previewLoading ? (
                  <span className="text-sm text-gray-400">Counting recipients...</span>
                ) : (
                  <span className="text-sm text-gray-700">
                    <strong className="text-gray-900">{preview?.count ?? '—'}</strong> users will receive this email
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowPreview(v => !v)}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPreview ? 'Hide' : 'Preview'} list
              </button>
            </div>

            {/* Recipient preview list */}
            {showPreview && preview && preview.preview.length > 0 && (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-400 font-semibold">Name</th>
                      <th className="text-left px-3 py-2 text-gray-400 font-semibold">Email</th>
                      <th className="text-left px-3 py-2 text-gray-400 font-semibold">Role</th>
                      <th className="text-left px-3 py-2 text-gray-400 font-semibold">Area</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.preview.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 font-medium">{p.name || '—'}</td>
                        <td className="px-3 py-2 text-gray-500 font-mono">{p.email}</td>
                        <td className="px-3 py-2 text-gray-500 capitalize">{p.role}</td>
                        <td className="px-3 py-2 text-gray-400">{p.area || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(preview.count > 5) && (
                  <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-center text-xs text-gray-400">
                    + {preview.count - 5} more recipients
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Compose ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Compose Message</p>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Subject <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Important Notice from MCL Administration"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Message <span className="text-red-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={8}
                placeholder={`Write your message here...\n\nEach recipient will see their own name and role at the top.\n\nExample:\nPlease note that the portal has been updated. Login using:\nhttps://mclportal.vercel.app/login\n\nRegards,\nMCL Administration`}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors resize-none leading-relaxed font-mono"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                {message.length} characters · Each email is personalised with the recipient's name and role automatically.
              </p>
            </div>

            {/* Live email preview */}
            {message && subject && (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 flex items-center gap-2 border-b border-gray-100">
                  <Eye className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Preview</span>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-semibold w-14">Subject:</span>
                    <span className="font-medium text-gray-800">{subject}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <div className="bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-t-lg">
                      Mahanadi Coalfields Limited
                    </div>
                    <div className="border border-t-0 border-gray-100 rounded-b-lg px-4 py-3 text-xs text-gray-600 space-y-2">
                      <p>Dear <strong>Rahul Sharma</strong> <span className="text-gray-400">(Intern — Talcher Area)</span>,</p>
                      <div className="bg-gray-50 border-l-4 border-emerald-600 pl-3 py-2 text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {message.slice(0, 300)}{message.length > 300 ? '...' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Confirm & Send ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600 flex-shrink-0"
              />
              <span className="text-sm text-gray-700">
                I confirm I want to send this email to{' '}
                <strong>{preview?.count ?? '—'} users</strong>
                {!isHQ && <span className="text-amber-700"> in {adminArea} Area</span>}.
                This cannot be undone.
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending emails... please keep this page open
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send to {preview?.count ?? '—'} Recipients
                  {!isHQ && <span className="opacity-70 text-xs ml-1">({adminArea} Area)</span>}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ── Result ─────────────────────────────────────────────── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-gray-900 text-lg">Broadcast Complete</p>
              <p className="text-sm text-gray-500">Subject: <em>{subject}</em></p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-emerald-700">{result.sent}</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">✅ Sent</p>
            </div>
            <div className={`border rounded-xl p-4 text-center ${result.failed > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-3xl font-bold ${result.failed > 0 ? 'text-red-700' : 'text-gray-300'}`}>{result.failed}</p>
              <p className={`text-xs font-semibold mt-1 ${result.failed > 0 ? 'text-red-600' : 'text-gray-300'}`}>❌ Failed</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-gray-700">{result.total}</p>
              <p className="text-xs text-gray-500 font-semibold mt-1">Total</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-xs font-bold text-red-700 mb-2">Failed deliveries:</p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600 font-mono">{e}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => { setResult(null); setConfirmed(false); setSubject(''); setMessage('') }}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Compose Another Email
          </button>
        </div>
      )}
    </div>
  )
}
