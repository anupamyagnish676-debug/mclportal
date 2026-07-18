'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, ShieldCheck, ShieldOff, Smartphone, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'

type Factor = {
  id: string
  friendly_name?: string
  factor_type: string
  status: 'verified' | 'unverified'
  created_at: string
}

type MFAStep = 'idle' | 'enrolling' | 'verifying' | 'success'

export default function MFAManager() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [factors, setFactors] = useState<Factor[]>([])
  const [step, setStep] = useState<MFAStep>('idle')
  const [qrCode, setQrCode] = useState<string>('')
  const [secret, setSecret] = useState<string>('')
  const [factorId, setFactorId] = useState<string>('')
  const [code, setCode] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState('')
  const [unenrolling, setUnenrolling] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadFactors() {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      // Only show verified TOTP factors
      const totpFactors = (data?.totp || []).filter((f: any) => f.status === 'verified')
      setFactors(totpFactors)
    } catch (e: any) {
      console.error('MFA load error:', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFactors()
  }, [])

  useEffect(() => {
    if (step === 'verifying' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [step])

  async function handleEnroll() {
    setError('')
    setStep('enrolling')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'MCL Portal Authenticator',
      })
      if (error) throw error
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setStep('verifying')
    } catch (e: any) {
      setError(e.message || 'Failed to start enrollment')
      setStep('idle')
    }
  }

  async function handleVerify() {
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code')
      return
    }
    setError('')
    try {
      // Challenge then verify
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeErr) throw challengeErr

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      })
      if (verifyErr) throw verifyErr

      setStep('success')
      setCode('')
      await loadFactors()
    } catch (e: any) {
      setError(e.message || 'Invalid code. Please try again.')
      setCode('')
      inputRef.current?.focus()
    }
  }

  async function handleUnenroll(id: string) {
    if (!confirm('Are you sure you want to disable MFA? This will remove 2-factor authentication from your account.')) return
    setUnenrolling(true)
    setError('')
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
      if (error) throw error
      await loadFactors()
    } catch (e: any) {
      setError(e.message || 'Failed to disable MFA')
    } finally {
      setUnenrolling(false)
    }
  }

  function handleCodeInput(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length === 6) {
      // auto-submit when 6 digits entered
      setTimeout(() => {
        document.getElementById('mfa-verify-btn')?.click()
      }, 50)
    }
  }

  const isEnrolled = factors.length > 0

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
        {isEnrolled
          ? <ShieldCheck className="w-4 h-4 text-emerald-600" />
          : <Shield className="w-4 h-4 text-gray-400" />
        }
        <div>
          <h2 className="text-sm font-bold text-gray-900">Two-Factor Authentication (2FA)</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Add an extra layer of security using an authenticator app like Google Authenticator or Authy.
          </p>
        </div>
      </div>

      {/* Status Badge */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold w-fit ${
        isEnrolled
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          : 'bg-gray-50 text-gray-500 border border-gray-100'
      }`}>
        {isEnrolled
          ? <><CheckCircle2 className="w-3.5 h-3.5" /> 2FA is Active</>
          : <><AlertCircle className="w-3.5 h-3.5" /> 2FA is Not Enabled</>
        }
      </div>

      {/* Enrolled factors list */}
      {isEnrolled && step !== 'success' && (
        <div className="space-y-2">
          {factors.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{f.friendly_name || 'Authenticator App'}</p>
                  <p className="text-[10px] text-gray-400">
                    Enrolled {new Date(f.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleUnenroll(f.id)}
                disabled={unenrolling}
                className="flex items-center gap-1.5 text-[10px] text-red-600 hover:text-red-700 border border-red-100 hover:border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors font-semibold disabled:opacity-50"
              >
                {unenrolling ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
                {unenrolling ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Idle state — not enrolled */}
      {!isEnrolled && step === 'idle' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            Without 2FA, your account is protected only by your password. Enable 2FA to require a time-based code from your phone on every login.
          </p>
          <button
            onClick={handleEnroll}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Shield className="w-4 h-4" />
            Enable Two-Factor Authentication
          </button>
        </div>
      )}

      {/* Enrolling — loading QR */}
      {step === 'enrolling' && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          Generating QR code...
        </div>
      )}

      {/* Verifying — show QR + code input */}
      {step === 'verifying' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
            <strong>Step 1:</strong> Open <strong>Google Authenticator</strong> or <strong>Authy</strong> on your phone.<br />
            <strong>Step 2:</strong> Tap the <strong>+</strong> button → <strong>Scan QR code</strong>.<br />
            <strong>Step 3:</strong> Enter the 6-digit code shown in the app below.
          </div>

          {/* QR Code */}
          {qrCode && (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white border-2 border-gray-200 rounded-xl p-3 inline-block shadow-sm">
                <img src={qrCode} alt="MFA QR Code" className="w-44 h-44 block" />
              </div>
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showSecret ? 'Hide' : 'Can\'t scan? Show'} manual key
              </button>
              {showSecret && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 tracking-widest select-all">
                  {secret}
                </div>
              )}
            </div>
          )}

          {/* 6-digit input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Enter 6-digit verification code
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
              className="w-full text-center text-2xl font-bold tracking-[0.5em] border border-gray-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              id="mfa-verify-btn"
              onClick={handleVerify}
              disabled={code.length !== 6}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
            >
              Verify & Activate 2FA
            </button>
            <button
              onClick={() => { setStep('idle'); setQrCode(''); setCode(''); setError('') }}
              className="px-4 py-2.5 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {step === 'success' && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Two-Factor Authentication Enabled!</p>
            <p className="text-xs text-emerald-600 mt-1">
              Your account is now protected with 2FA. You'll be asked for a 6-digit code from your authenticator app on every login.
            </p>
            <button
              onClick={() => setStep('idle')}
              className="mt-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
            >
              Got it →
            </button>
          </div>
        </div>
      )}

      {error && step === 'idle' && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
