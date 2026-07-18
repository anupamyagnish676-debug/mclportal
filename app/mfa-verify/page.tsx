'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function MFAVerifyContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams?.get('next') || '/admin'

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleVerify(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (code.length !== 6) return

    setLoading(true)
    setError('')
    setStatus('Verifying code...')

    try {
      // List factors to get the factorId
      const { data: factorsData, error: listErr } = await supabase.auth.mfa.listFactors()
      if (listErr) throw listErr

      const totpFactor = factorsData?.totp?.find((f: any) => f.status === 'verified')
      if (!totpFactor) {
        throw new Error('No verified authenticator found. Please set up 2FA in Settings first.')
      }

      // Challenge
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      })
      if (challengeErr) throw challengeErr

      // Verify
      const { data: verifyData, error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code,
      })
      if (verifyErr) throw verifyErr

      // Update the mcl-session with new tokens from the verified AAL2 session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const cookieVal = encodeURIComponent(JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }))
        document.cookie = `mcl-session=${cookieVal}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`
      }

      setStatus('Verified! Redirecting...')
      await new Promise(r => setTimeout(r, 400))
      window.location.href = next
    } catch (e: any) {
      setError(e.message || 'Invalid code. Please try again.')
      setCode('')
      setStatus('')
      setLoading(false)
      inputRef.current?.focus()
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
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0 scale-105 pointer-events-none select-none brightness-[0.8] animate-kenburns"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#021f18]/95 via-[#020617]/80 to-[#030712]/50 z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/40 to-[#020617]/90 z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-premium-grid z-0 pointer-events-none opacity-60" />
      <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] z-0 pointer-events-none animate-float-1" />
      <div className="absolute -bottom-20 right-10 w-[600px] h-[600px] bg-green-900/20 rounded-full blur-[140px] z-0 pointer-events-none animate-float-2" />

      {/* Card */}
      <div className="z-10 w-full max-w-sm bg-[#040f0c]/60 border border-white/10 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.6)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center backdrop-blur-sm">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3.75h3m-3 3.75h.008v.008H10.5v-.008zm3.75 0h.008v.008h-.008v-.008z" />
            </svg>
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white tracking-tight">Two-Factor Authentication</h1>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Open your authenticator app and enter the 6-digit code for <strong className="text-slate-300">MCL Portal</strong>.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
              Verification Code
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
              className="w-full text-center text-3xl font-bold tracking-[0.6em] bg-[#020617]/50 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-xs backdrop-blur-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {status && !error && (
            <div className="bg-blue-950/40 border border-blue-500/20 text-blue-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2 backdrop-blur-sm">
              <svg className="animate-spin h-4 w-4 text-blue-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {status}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white py-3 rounded-xl text-sm font-semibold transition-all duration-300 shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.45)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify →'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a
            href="/login"
            className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
          >
            ← Back to login
          </a>
        </div>

        <p className="text-center text-[10px] text-slate-500 mt-6 leading-normal border-t border-white/5 pt-4">
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
