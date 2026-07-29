'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const IDLE_TIMEOUT_MS = 15 * 60 * 1000   // 15 minutes
const WARNING_AT_MS  = 14 * 60 * 1000   // show warning at 14 min
const WARNING_DURATION_MS = 60 * 1000   // 60 second countdown

interface SessionGuardProps {
  sessionNonce?: string   // passed from server layout — the DB nonce
}

export default function SessionGuard({ sessionNonce }: SessionGuardProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const lastActivityRef = useRef<number>(Date.now())
  const warningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Single session check on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!sessionNonce) return

    const cookieNonce = document.cookie
      .split('; ')
      .find(c => c.startsWith('mcl-session-nonce='))
      ?.split('=')[1]

    if (cookieNonce && cookieNonce !== sessionNonce) {
      // Nonce mismatch — another device signed in → kick this session
      handleKick('You were signed in on another device. This session has been ended.')
    }
  }, [sessionNonce])

  // ── Logout helpers ────────────────────────────────────────────────────────
  const handleLogout = useCallback(async (reason: 'timeout' | 'kick', message?: string) => {
    try {
      await supabase.auth.signOut()
      // Clear cookies
      document.cookie = 'mcl-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'mcl-session-nonce=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0].trim()
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        }
      })
      // Call logout API for audit log
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
    } catch {}
    const url = reason === 'timeout'
      ? '/login?reason=timeout'
      : '/login?reason=session_kicked'
    window.location.href = url
  }, [supabase])

  const handleKick = useCallback((msg: string) => {
    handleLogout('kick', msg)
  }, [handleLogout])

  // ── Activity tracking ─────────────────────────────────────────────────────
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (showWarning) {
      setShowWarning(false)
      setCountdown(60)
      if (warningTimerRef.current) {
        clearInterval(warningTimerRef.current)
        warningTimerRef.current = null
      }
    }
  }, [showWarning])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetActivity, { passive: true }))

    // Check idle every 30 seconds
    idleCheckRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current
      if (idle >= IDLE_TIMEOUT_MS) {
        handleLogout('timeout')
      } else if (idle >= WARNING_AT_MS && !showWarning) {
        setShowWarning(true)
      }
    }, 30_000)

    return () => {
      events.forEach(e => window.removeEventListener(e, resetActivity))
      if (idleCheckRef.current) clearInterval(idleCheckRef.current)
    }
  }, [resetActivity, handleLogout, showWarning])

  // ── Countdown when warning is shown ───────────────────────────────────────
  useEffect(() => {
    if (!showWarning) return
    setCountdown(60)

    warningTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(warningTimerRef.current!)
          handleLogout('timeout')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (warningTimerRef.current) clearInterval(warningTimerRef.current)
    }
  }, [showWarning, handleLogout])

  if (!showWarning) return null

  // ── Warning Modal ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-amber-100 max-w-sm w-full p-6 space-y-4">
        {/* Icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Session Expiring Soon</h3>
            <p className="text-xs text-gray-500 mt-0.5">You've been inactive for 14 minutes</p>
          </div>
        </div>

        {/* Countdown */}
        <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
          <p className="text-xs text-amber-700 font-medium mb-1">Signing out in</p>
          <p className="text-4xl font-bold text-amber-600 tabular-nums">{countdown}s</p>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-1000"
              style={{ width: `${(countdown / 60) * 100}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={resetActivity}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            Stay Signed In
          </button>
          <button
            onClick={() => handleLogout('timeout')}
            className="px-4 py-2.5 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-sm font-semibold transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
