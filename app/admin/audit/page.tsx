'use client'
import { useState, useEffect, useCallback } from 'react'
import { Shield, LogIn, LogOut, AlertTriangle, Ban, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react'

type AuditLog = {
  id: string
  user_id: string | null
  user_email: string | null
  role: string | null
  action: string
  details: Record<string, any> | null
  ip_address: string | null
  created_at: string
}

const ACTION_STYLES: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  LOGIN:                { color: 'bg-emerald-50 text-emerald-700 border-emerald-100',   icon: <LogIn className="w-3 h-3" />,        label: 'Login' },
  LOGOUT:               { color: 'bg-slate-50 text-slate-600 border-slate-100',         icon: <LogOut className="w-3 h-3" />,       label: 'Logout' },
  LOGIN_FAILED:         { color: 'bg-amber-50 text-amber-700 border-amber-100',         icon: <AlertTriangle className="w-3 h-3" />, label: 'Failed Login' },
  LOGIN_BLOCKED:        { color: 'bg-red-50 text-red-700 border-red-100',              icon: <Ban className="w-3 h-3" />,          label: 'Blocked' },
  MFA_VERIFIED:         { color: 'bg-blue-50 text-blue-700 border-blue-100',           icon: <Shield className="w-3 h-3" />,       label: 'MFA Verified' },
  SESSION_EXPIRED:      { color: 'bg-orange-50 text-orange-700 border-orange-100',     icon: <AlertTriangle className="w-3 h-3" />, label: 'Session Expired' },
  SESSION_KICKED:       { color: 'bg-purple-50 text-purple-700 border-purple-100',     icon: <Ban className="w-3 h-3" />,          label: 'Session Kicked' },
  CERTIFICATE_ISSUED:   { color: 'bg-teal-50 text-teal-700 border-teal-100',           icon: <Shield className="w-3 h-3" />,       label: 'Certificate Issued' },
  APPLICATION_APPROVED: { color: 'bg-green-50 text-green-700 border-green-100',        icon: <Shield className="w-3 h-3" />,       label: 'App Approved' },
  USER_CREATED:         { color: 'bg-indigo-50 text-indigo-700 border-indigo-100',     icon: <Shield className="w-3 h-3" />,       label: 'User Created' },
}

const ALL_ACTIONS = Object.keys(ACTION_STYLES)

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (action) params.set('action', action)
      const res = await fetch(`/api/audit?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch {}
    setLoading(false)
  }, [page, action])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Security Audit Log</h1>
          <p className="text-gray-500 text-sm">Complete record of all authentication and admin actions</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: total, color: 'text-gray-900' },
          { label: 'Logins', value: logs.filter(l => l.action === 'LOGIN').length, color: 'text-emerald-700' },
          { label: 'Failed Attempts', value: logs.filter(l => l.action === 'LOGIN_FAILED').length, color: 'text-amber-700' },
          { label: 'Blocked', value: logs.filter(l => l.action === 'LOGIN_BLOCKED').length, color: 'text-red-700' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter by action:</span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => { setAction(''); setPage(1) }}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              !action ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            All
          </button>
          {ALL_ACTIONS.map(a => (
            <button
              key={a}
              onClick={() => { setAction(a); setPage(1) }}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                action === a ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {ACTION_STYLES[a]?.label || a}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Shield className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No audit events found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Action</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">IP Address</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Details</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Time (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => {
                  const style = ACTION_STYLES[log.action] || { color: 'bg-gray-50 text-gray-600 border-gray-100', icon: null, label: log.action }
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.color}`}>
                          {style.icon}
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs max-w-[180px] truncate">{log.user_email || '—'}</td>
                      <td className="px-4 py-3">
                        {log.role && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium capitalize">{log.role}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{log.ip_address || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatTime(log.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
            <p className="text-xs text-gray-400">Page {page} of {totalPages} · {total} total events</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
