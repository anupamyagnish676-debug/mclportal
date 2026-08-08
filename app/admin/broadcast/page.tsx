'use client'
import { useState } from 'react'
import { Mail, Send, CheckCircle2, AlertCircle, Loader2, Users } from 'lucide-react'

type Result = {
  sent: number
  failed: number
  total: number
  errors: string[]
}

export default function BroadcastEmailPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  async function handleSend() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/admin/broadcast-email', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to send emails')
      } else {
        setResult(data)
      }
    } catch (e: any) {
      setError(e.message || 'Network error')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Broadcast Email</h1>
        <p className="text-gray-500 text-sm">Send a portal update notification to all registered users</p>
      </div>

      {/* Preview Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-emerald-700 px-6 py-4">
          <p className="text-white font-bold text-base">Mahanadi Coalfields Limited</p>
          <p className="text-emerald-200 text-xs mt-0.5">A Subsidiary of Coal India Limited</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Subject</p>
            <p className="text-sm font-semibold text-gray-800">📢 MCL Internship Portal — New Link & Updates</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Email Preview</p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-2 border border-gray-100">
              <p>Dear <strong>[User Name]</strong>,</p>
              <p>The MCL Internship Portal has been updated. Please use the link below to access your account going forward.</p>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                <p className="text-xs text-emerald-700 font-bold mb-1">YOUR PORTAL LINK</p>
                <p className="text-emerald-700 font-bold text-sm">https://mclportal.vercel.app/login</p>
              </div>
              <p className="text-xs text-gray-500">Each email is personalised with the user's name, login email, role, and area.</p>
            </div>
          </div>

          {/* Who gets it */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
            <Users className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700">
              <p className="font-bold mb-1">Who will receive this email?</p>
              <p>All registered users — Admins, Finance Officers, Mentors, Interns, and Employees who have an email address in the system.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation + Send */}
      {!result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-600"
            />
            <span className="text-sm text-gray-700">
              I confirm I want to send this email to <strong>all users</strong> in the portal. This action cannot be undone.
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
            disabled={!confirmed || loading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending emails... (this may take a minute)
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send to All Users
              </>
            )}
          </button>

          {loading && (
            <p className="text-center text-xs text-gray-400">
              Sending personalised emails one by one. Please keep this page open until complete.
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-gray-900">Emails Sent Successfully</p>
              <p className="text-sm text-gray-500 mt-0.5">Broadcast complete</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{result.sent}</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">Sent</p>
            </div>
            <div className={`border rounded-xl p-4 text-center ${result.failed > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-2xl font-bold ${result.failed > 0 ? 'text-red-700' : 'text-gray-400'}`}>{result.failed}</p>
              <p className={`text-xs font-semibold mt-1 ${result.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>Failed</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-700">{result.total}</p>
              <p className="text-xs text-gray-500 font-semibold mt-1">Total Users</p>
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
            onClick={() => { setResult(null); setConfirmed(false) }}
            className="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            Send Again
          </button>
        </div>
      )}
    </div>
  )
}
