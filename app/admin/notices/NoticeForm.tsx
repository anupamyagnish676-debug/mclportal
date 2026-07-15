'use client'
import { useState } from 'react'

interface Area {
  name: string
}

interface NoticeFormProps {
  areas: Area[]
  isAdminGlobal: boolean
  currentArea: string
  onNoticePosted?: () => void
}

export default function NoticeForm({ areas, isAdminGlobal, currentArea, onNoticePosted }: NoticeFormProps) {
  const [title, setTitle] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  
  // Expiry configuration state
  const [expiryType, setExpiryType] = useState<'never' | 'custom'>('custom')
  const getDefaultExpiryString = () => {
    const defaultDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const pad = (num: number) => num.toString().padStart(2, '0')
    return `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`
  }
  const getMinExpiryString = () => {
    const now = new Date()
    const pad = (num: number) => num.toString().padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  }
  const [customExpiresAt, setCustomExpiresAt] = useState<string>(getDefaultExpiryString())

  // Target roles state
  const [targetStudent, setTargetStudent] = useState<boolean>(true)
  const [targetMentor, setTargetMentor] = useState<boolean>(true)
  const [targetEmployee, setTargetEmployee] = useState<boolean>(false)

  // Target areas state (HQ only)
  const [areaScope, setAreaScope] = useState<'all' | 'specific'>('all')
  const [specificArea, setSpecificArea] = useState<string>('')

  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<boolean>(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !content) {
      setError('Please fill in both title and content.')
      return
    }

    const roles: string[] = []
    if (targetStudent) roles.push('student')
    if (targetMentor) roles.push('mentor')
    if (targetEmployee) roles.push('employee')

    if (roles.length === 0) {
      setError('Please select at least one target recipient role.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess(false)

    // Build target areas array
    let targetAreas = ['all']
    if (isAdminGlobal) {
      if (areaScope === 'specific') {
        if (!specificArea) {
          setError('Please select a target area.')
          setSubmitting(false)
          return
        }
        targetAreas = [specificArea]
      }
    } else {
      // Area admin can only post to their own area
      targetAreas = [currentArea]
    }

    const expiresAt = expiryType === 'never' ? null : new Date(customExpiresAt).toISOString()

    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          target_roles: roles,
          target_areas: targetAreas,
          priority,
          expires_at: expiresAt
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to post notice')

      setTitle('')
      setContent('')
      setCustomExpiresAt(getDefaultExpiryString())
      setSuccess(true)
      if (onNoticePosted) onNoticePosted()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Create New Notice / Announcement</h2>
        <p className="text-xs text-gray-500">Post announcements to intern and mentor feeds.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Notice Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Important announcement title..."
            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-green-600"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Priority Level</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:border-green-600"
          >
            <option value="normal">Normal</option>
            <option value="urgent">🔴 Urgent Announcement</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Notice Expiry</label>
          <select
            value={expiryType}
            onChange={(e) => setExpiryType(e.target.value as any)}
            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:border-green-600"
          >
            <option value="custom">📅 Specific Expiry</option>
            <option value="never">♾️ No Expiry (Never)</option>
          </select>
        </div>
      </div>

      {expiryType === 'custom' && (
        <div className="space-y-1 max-w-sm">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Expiry Date & Time</label>
          <input
            type="datetime-local"
            value={customExpiresAt}
            min={getMinExpiryString()}
            onChange={(e) => setCustomExpiresAt(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-green-600"
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Announcement Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Compose notice message content..."
          className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Recipient Roles */}
        <div className="space-y-2">
          <span className="block text-xs font-bold uppercase tracking-wider text-gray-400">Recipient Roles</span>
          <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={targetStudent}
                onChange={(e) => setTargetStudent(e.target.checked)}
                className="rounded border-gray-300 text-green-700 focus:ring-green-600"
              />
              Students
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={targetMentor}
                onChange={(e) => setTargetMentor(e.target.checked)}
                className="rounded border-gray-300 text-green-700 focus:ring-green-600"
              />
              Mentors
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={targetEmployee}
                onChange={(e) => setTargetEmployee(e.target.checked)}
                className="rounded border-gray-300 text-green-700 focus:ring-green-600"
              />
              Area Employees
            </label>
          </div>
        </div>

        {/* Target Area Scope (HQ Admins only) */}
        {isAdminGlobal ? (
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-400">Target Area Scope</span>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={areaScope === 'all'}
                  onChange={() => setAreaScope('all')}
                  className="text-green-700 focus:ring-green-600"
                />
                All Areas
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={areaScope === 'specific'}
                  onChange={() => setAreaScope('specific')}
                  className="text-green-700 focus:ring-green-600"
                />
                Specific Area
              </label>

              {areaScope === 'specific' && (
                <select
                  value={specificArea}
                  onChange={(e) => setSpecificArea(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg p-1.5 bg-white focus:outline-none"
                >
                  <option value="">Select area...</option>
                  {areas.filter(a => a.name !== 'Headquarters').map(a => (
                    <option key={a.name} value={a.name}>{a.name} Area</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-400">Target Area Scope</span>
            <p className="text-xs text-gray-500 font-semibold">{currentArea} Area (Local Only)</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 text-xs p-3 rounded-xl">
          Notice posted successfully.
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 bg-[#166534] hover:bg-[#155e2f] text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
      >
        {submitting ? 'Posting...' : 'Publish Announcement'}
      </button>
    </form>
  )
}
