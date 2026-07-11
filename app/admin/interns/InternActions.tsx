'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DollarSign, Trash2, Shield, Settings, Check } from 'lucide-react'

export default function InternActions({
  internshipId,
  studentId,
  studentName,
  isActive,
  initialType,
  initialAmount,
  initialFrequency
}: {
  internshipId: string
  studentId: string
  studentName: string
  isActive: boolean
  initialType: 'paid' | 'unpaid'
  initialAmount: number
  initialFrequency: 'monthly' | 'lumpsum'
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(isActive)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  // Stipend state
  const [showConfig, setShowConfig] = useState(false)
  const [type, setType] = useState<'paid' | 'unpaid'>(initialType)
  const [amount, setAmount] = useState<number>(initialAmount)
  const [frequency, setFrequency] = useState<'monthly' | 'lumpsum'>(initialFrequency)

  // Payment cycle state
  const [period, setPeriod] = useState('')
  const [cycleAmount, setCycleAmount] = useState(initialAmount.toString())

  async function toggleAccess() {
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase
      .from('internships')
      .update({ is_active: !active })
      .eq('id', internshipId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setActive(!active)
      router.refresh()
    }
    setLoading(false)
  }

  async function deleteStudent() {
    const confirmDelete = window.confirm(
      `Warning: Are you sure you want to permanently delete student "${studentName}"?\n\nThis will permanently delete their account, profile, attendance logs, and assignment submissions from the database.`
    )
    if (!confirmDelete) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, internshipId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to delete student')
      } else {
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during deletion')
    }
    setLoading(false)
  }

  async function saveStipendConfig() {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/update-internship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internshipId,
          internship_type: type
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update category')

      setSuccess('Stipend configuration saved!')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <div className="flex gap-1.5 flex-wrap items-center">
        <button
          onClick={() => { setShowConfig(!showConfig); setError(''); setSuccess(''); }}
          className="px-2 py-1 text-xs bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-1 border border-slate-200 transition-colors"
        >
          <DollarSign className="w-3 h-3 text-[#166534]" />
          Stipend ({initialType === 'paid' ? 'Paid' : 'Unpaid'})
        </button>

        <button onClick={toggleAccess} disabled={loading}
          className={`px-2 py-1 text-xs rounded-lg disabled:opacity-50 transition-colors ${
            active ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
          }`}>
          {active ? 'Deactivate' : 'Activate'}
        </button>

        <button
          onClick={deleteStudent}
          disabled={loading}
          className="px-2 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50 transition-colors"
        >
          Delete
        </button>
      </div>

      {error && <p className="text-red-500 text-[10px] mt-1 font-semibold">{error}</p>}
      {success && <p className="text-green-600 text-[10px] mt-1 font-semibold">{success}</p>}

      {/* Stipend Config Dropdown Panel */}
      {showConfig && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-gray-150 p-4 shadow-xl z-30 space-y-4">
          <div className="border-b border-gray-100 pb-2">
            <h4 className="font-bold text-xs text-gray-800">Stipend Configuration</h4>
            <p className="text-[10px] text-gray-400">Configure paid/unpaid status for {studentName}</p>
          </div>

          <div className="space-y-3 text-xs">
            {/* Type Select */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Internship Category</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full text-xs border border-gray-200 rounded-lg p-1.5 bg-white focus:outline-none focus:border-green-600"
              >
                <option value="unpaid">Unpaid Internship</option>
                <option value="paid">Paid Internship</option>
              </select>
            </div>

            {type === 'paid' && (
              <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded-lg leading-relaxed mt-2">
                ℹ️ Student will be requested to submit their bank details. The Finance Dept will verify them and configure the stipend amount and frequency.
              </p>
            )}

            <div className="flex gap-1.5 pt-2 justify-end border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-2.5 py-1 text-[10px] border border-gray-200 rounded-lg text-gray-500"
              >
                Close
              </button>
              <button
                type="button"
                onClick={saveStipendConfig}
                disabled={loading}
                className="px-3 py-1 bg-green-700 hover:bg-green-800 text-white rounded-lg text-[10px] font-semibold transition-colors"
              >
                Save Config
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
