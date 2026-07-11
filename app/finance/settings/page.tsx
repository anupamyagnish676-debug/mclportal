'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SignaturePad from '@/components/SignaturePad'
import { Lock, PenTool } from 'lucide-react'

export default function FinanceSettingsPage() {
  const supabase = createClient()
  const [existingSig, setExistingSig] = useState<string | null>(null)
  const [loadingSig, setLoadingSig] = useState(true)

  // Password state
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('signature_data')
        .eq('id', user.id)
        .maybeSingle()
      setExistingSig(data?.signature_data || null)
      setLoadingSig(false)
    }
    loadProfile()
  }, [])

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwLoading(true)
    setPwMessage(null)

    if (passwords.newPassword.length < 6) {
      setPwMessage({ type: 'error', text: 'New password must be at least 6 characters long.' })
      setPwLoading(false)
      return
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPwMessage({ type: 'error', text: 'Passwords do not match.' })
      setPwLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.newPassword })
      if (error) throw new Error(error.message)
      setPwMessage({ type: 'success', text: 'Password updated successfully!' })
      setPasswords({ newPassword: '', confirmPassword: '' })
    } catch (err: any) {
      setPwMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' })
    }
    setPwLoading(false)
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Account Settings</h1>
        <p className="text-gray-500 text-sm">Manage your digital signature and account password.</p>
      </div>

      {/* Digital Signature Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
          <PenTool className="w-4 h-4 text-green-700" />
          <div>
            <h2 className="text-sm font-bold text-gray-900">Digital Signature</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Your signature will appear on internship completion certificates for paid interns in your area.
            </p>
          </div>
        </div>

        {loadingSig ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
          </div>
        ) : (
          <SignaturePad
            existingSignature={existingSig}
            onSaved={() => {}}
          />
        )}
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
          <Lock className="w-4 h-4 text-green-700" />
          <div>
            <h2 className="text-sm font-bold text-gray-900">Change Password</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Update your portal login password.</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={passwords.newPassword}
              onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
              placeholder="Minimum 6 characters"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={passwords.confirmPassword}
              onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              placeholder="Confirm new password"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          {pwMessage && (
            <div className={`px-4 py-2.5 rounded-xl text-xs border ${
              pwMessage.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {pwMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={pwLoading}
            className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {pwLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
