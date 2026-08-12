'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Mail, Lock } from 'lucide-react'

export default function MFAManager() {
  const supabase = createClient()
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setEmail(user.email)
      }
    }
    loadUser()
  }, [])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">Two-Factor Authentication (Email OTP 2FA)</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Universal 6-digit One-Time Password sent to your registered email on every login.
          </p>
        </div>
      </div>

      <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
        <Mail className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-emerald-900">
            2FA Active for {email || 'your account'}
          </p>
          <p className="text-[11px] text-emerald-700 leading-relaxed">
            Every login attempt triggers an automatic 6-digit verification code sent via Gmail SMTP to <strong className="text-emerald-900">{email}</strong>. Authenticator apps are no longer needed!
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium pt-1">
        <Lock className="w-3.5 h-3.5 text-emerald-600" />
        <span>HMAC-SHA256 Cryptographically Secured · Expires in 5 minutes per login</span>
      </div>
    </div>
  )
}
