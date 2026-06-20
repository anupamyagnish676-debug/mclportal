'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SettingsForm() {
  const supabase = createClient()
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (passwords.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters long.' })
      setLoading(false)
      return
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword,
      })

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'Password updated successfully!' })
        setPasswords({ newPassword: '', confirmPassword: '' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' })
    }
    setLoading(false)
  }

  return (
    <div className="max-w-md">
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={passwords.newPassword}
              onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
              placeholder="Minimum 6 characters"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={passwords.confirmPassword}
              onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              placeholder="Confirm new password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          {message && (
            <div className={`px-4 py-3 rounded-lg text-sm border ${
              message.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
