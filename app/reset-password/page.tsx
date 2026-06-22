'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [status, setStatus]                   = useState('')
  const [sessionChecked, setSessionChecked]   = useState(false)
  const [hasSession, setHasSession]           = useState(false)
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function checkSession() {
      // Check if user is authenticated (which they will be automatically after clicking the reset email link)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setHasSession(true)
      }
      setSessionChecked(true)
    }
    checkSession()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setStatus('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: password.trim(),
      })

      if (updateErr) {
        setError(updateErr.message)
      } else {
        setStatus('Password updated successfully! Redirecting to login...')
        setTimeout(() => {
          // Clear any session and redirect to login
          supabase.auth.signOut().then(() => {
            router.push('/login?reset=success')
          })
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 font-semibold text-sm animate-pulse">Verifying recovery session...</div>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-2xl font-bold mx-auto">
            ✗
          </div>
          <h1 className="text-xl font-bold text-gray-900">Session Invalid or Expired</h1>
          <p className="text-sm text-gray-500">
            For security, password reset links can only be accessed by clicking the link in the recovery email. Please request a new recovery link.
          </p>
          <div className="pt-2">
            <Link href="/forgot-password" className="text-sm font-semibold text-green-600 hover:text-green-700">
              Request new link →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/mcl-logo.jpg" alt="MCL Logo" className="h-16 mx-auto mb-4 object-contain rounded-lg" />
          <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
          <p className="text-gray-400 text-sm mt-1">Please enter your new portal login password</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {status && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm font-semibold">
              {status}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating password...' : 'Update Password →'}
          </button>
        </form>
      </div>
    </div>
  )
}
