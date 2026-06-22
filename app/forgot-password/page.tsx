'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [status, setStatus]   = useState('')
  const supabase = createClient()

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setStatus('')

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetErr) {
        setError(resetErr.message)
      } else {
        setStatus('Password reset link sent! Please check your email inbox.')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send recovery email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/mcl-logo.jpg" alt="MCL Logo" className="h-16 mx-auto mb-4 object-contain rounded-lg" />
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-400 text-sm mt-1">Enter your email address to recover your account</p>
        </div>

        <form onSubmit={handleResetSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="name@mcl.com"
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
            {loading ? 'Sending link...' : 'Send Reset Link →'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link href="/login" className="text-xs font-semibold text-green-600 hover:text-green-700">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
