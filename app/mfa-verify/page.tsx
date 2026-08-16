'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail, RefreshCw, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react'

function MFAVerifyContent() {
  const searchParams = useSearchParams()
  const next  = searchParams?.get('next') || '/admin'
  const email = searchParams?.get('email') || ''

  const [code, setCode]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [status, setStatus]       = useState('')
  const [resendTimer, setResendTimer] = useState(30)
  const [resendMsg, setResendMsg]     = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Resend cooldown timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setInterval(() => setResendTimer(t => t - 1), 1000)
      return () => clearInterval(timer)
    }
  }, [resendTimer])

  async function handleVerify(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (code.length !== 6) return

    setLoading(true)
    setError('')
    setStatus('Verifying code...')

    try {
      const res = await fetch('/api/auth/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      setStatus('Verified! Redirecting...')
      await new Promise(r => setTimeout(r, 400))
      window.location.href = data.redirect || next
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP code.')
      setCode('')
      setStatus('')
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function handleResend() {
    if (resendTimer > 0) return
    setError('')
    setResendMsg('')
    try {
      const res = await fetch('/api/auth/resend-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to resend code')
      } else {
        setResendMsg('New 6-digit code sent to your email!')
        setResendTimer(30)
      }
    } catch {
      setError('Network error. Failed to resend.')
    }
  }

  function handleCodeInput(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length === 6) {
      setTimeout(() => handleVerify(), 50)
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-6 overflow-hidden font-sans bg-[#020617]">
      {/* Background elements */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0 scale-105 pointer-events-none select-none brightness-[0.8]"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#021f18]/95 via-[#020617]/80 to-[#030712]/50 z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/40 to-[#020617]/90 z-0 pointer-events-none" />
      <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] z-0 pointer-events-none" />

      {/* Card */}
      <div className="z-10 w-full max-w-sm bg-[#040f0c]/70 border border-white/10 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.6)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center backdrop-blur-sm shadow-inner">
            <Mail className="w-8 h-8 text-emerald-400" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            Email OTP Verification
          </h1>
          <p className="text-slate-300 text-xs mt-2 leading-relaxed">
            We sent a 6-digit verification code to
            {email ? <strong className="block text-emerald-400 font-semibold mt-0.5">{email}</strong> : ' your email inbox'}.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
              Enter 6-Digit Code
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={e => handleCodeInput(e.target.value)}
              placeholder="000000"
              maxLength={6}
              disabled={loading}
              className="w-full text-center text-3xl font-mono font-bold tracking-[0.6em] bg-[#020617]/70 border border-emerald-500/30 rounded-xl px-4 py-4 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="bg-red-950/60 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl text-xs backdrop-blur-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resendMsg && !error && (
            <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2 backdrop-blur-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{resendMsg}</span>
            </div>
          )}

          {status && !error && (
            <div className="bg-blue-950/60 border border-blue-500/30 text-blue-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 flex-shrink-0" />
              <span>{status}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white py-3 rounded-xl text-sm font-semibold transition-all duration-300 shadow-[0_4px_20px_rgba(16,185,129,0.25)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify OTP →'}
          </button>
        </form>

        {/* Resend button */}
        <div className="mt-5 text-center flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-white/5">
          <a href="/login" className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </a>
          <button
            onClick={handleResend}
            disabled={resendTimer > 0}
            className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 disabled:text-slate-500 font-medium transition-colors disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resendTimer === 0 ? 'animate-spin-slow' : ''}`} />
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
          </button>
        </div>

        <p className="text-center text-[10px] text-slate-500 mt-6 leading-normal">
          Training &amp; Development Department, MCL
        </p>
      </div>
    </div>
  )
}

export default function MFAVerifyPage() {
  return (
    <Suspense>
      <MFAVerifyContent />
    </Suspense>
  )
}
