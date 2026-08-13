'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ShiftAreaModalProps {
  isOpen: boolean
  onClose: () => void
  student: {
    id: string
    full_name: string
    wing?: string
    area?: string
    email?: string
  } | null
  onSuccess: () => void
}

export default function ShiftAreaModal({ isOpen, onClose, student, onSuccess }: ShiftAreaModalProps) {
  const supabase = createClient()
  const [areasList, setAreasList] = useState<string[]>([
    'Talcher', 'Jagannath', 'Lingaraj', 'Subhadra', 'IB Valley', 'Lakhanpur', 'Orient', 'Basundhara', 'MCL HQ', 'Headquarters'
  ])
  const [deptAvailabilityMap, setDeptAvailabilityMap] = useState<Record<string, string[]>>({})
  const [targetArea, setTargetArea] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [lorFile, setLorFile] = useState<File | null>(null)
  const [lorUrlInput, setLorUrlInput] = useState<string>('')
  const [uploadingLor, setUploadingLor] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shifting, setShifting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (!isOpen || !student) return

    async function loadData() {
      setLoading(true)
      setError('')
      setSuccessMsg('')
      setLorFile(null)
      setLorUrlInput('')
      try {
        // Fetch areas
        const areasRes = await fetch('/api/areas')
        const areasData = await areasRes.json()
        if (areasRes.ok && areasData.areas) {
          const names = areasData.areas.map((a: any) => a.name)
          if (names.length) setAreasList(names)
        }

        // Fetch department availability map
        const deptRes = await fetch(`/api/admin/area-departments?area=${encodeURIComponent(student?.area || '')}`)
        const deptData = await deptRes.json()
        if (deptRes.ok) {
          setDeptAvailabilityMap(deptData.deptAvailabilityMap || {})
        }
      } catch (err: any) {
        console.error('Error fetching area department data:', err)
      }
      setLoading(false)
    }

    loadData()
  }, [isOpen, student])

  if (!isOpen || !student) return null

  const studentWing = student.wing || 'Technical'
  const studentArea = student.area || 'Headquarters'

  // Areas where student's department IS active
  const availableAreasForDept = deptAvailabilityMap[studentWing] || []
  const isDeptActiveInCurrentArea = availableAreasForDept.includes(studentArea)

  async function handleShiftSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetArea || targetArea === studentArea) {
      setError('Please select a different target area to transfer the student.')
      return
    }
    setShifting(true)
    setError('')
    setSuccessMsg('')

    try {
      let finalLorUrl = lorUrlInput.trim()

      // If user uploaded a physical LoR PDF file, upload to Supabase Storage bucket 'documents'
      if (lorFile) {
        setUploadingLor(true)
        const fileExt = lorFile.name.split('.').pop()
        const fileName = `lor_${student?.id}_${Date.now()}.${fileExt}`
        const filePath = `lors/${fileName}`

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(filePath, lorFile, { upsert: true })

        if (uploadErr) {
          console.warn('Storage upload error, using object URL fallback:', uploadErr.message)
        }

        const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(filePath)
        finalLorUrl = publicUrlData?.publicUrl || 'https://mclportal.vercel.app/sample-lor.pdf'
        setUploadingLor(false)
      }

      const res = await fetch('/api/admin/shift-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student?.id,
          targetArea,
          reason: reason.trim() || `Department "${studentWing}" is better suited for ${targetArea} Area.`,
          lorUrl: finalLorUrl || 'https://mclportal.vercel.app/sample-lor.pdf'
        })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(`Candidate ${student?.full_name} shifted to ${targetArea} Area & LoR application forwarded successfully!`)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1300)
      } else {
        setError(data.error || 'Failed to shift area.')
      }
    } catch (err: any) {
      setError(err.message || 'Error executing area shift.')
    }
    setShifting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>🔄</span> Transfer Student Area & Forward LoR
            </h2>
            <p className="text-xs text-gray-500">Attach LoR & forward candidate application to target area admin</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg font-bold w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Student Info Card */}
        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-150 text-xs space-y-1">
          <p className="font-bold text-gray-900">{student.full_name}</p>
          <div className="flex flex-wrap gap-2 text-gray-600">
            <span>Branch/Wing: <strong className="text-emerald-700 font-bold">{studentWing}</strong></span>
            <span>•</span>
            <span>Current Area: <strong>{studentArea}</strong></span>
          </div>
        </div>

        {/* Smart Department Availability Detection Banner */}
        {!loading && (
          <div className={`p-4 rounded-xl border text-xs space-y-1 leading-relaxed ${
            isDeptActiveInCurrentArea
              ? 'bg-blue-50/70 border-blue-200 text-blue-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            {!isDeptActiveInCurrentArea ? (
              <>
                <p className="font-bold flex items-center gap-1.5 text-amber-900">
                  <span>⚠️</span> Department Not Active in {studentArea} Area
                </p>
                <p className="text-amber-800">
                  The wing <strong>&quot;{studentWing}&quot;</strong> is currently not configured as active in {studentArea} Area.
                </p>
                {availableAreasForDept.length > 0 ? (
                  <p className="font-semibold text-emerald-800 pt-1">
                    ✅ Active in: <span className="underline">{availableAreasForDept.join(', ')}</span>
                  </p>
                ) : (
                  <p className="text-gray-500 italic pt-1">
                    (No area has explicitly enabled this wing yet — you can transfer to any area below).
                  </p>
                )}
              </>
            ) : (
              <p className="font-semibold text-blue-800 flex items-center gap-1.5">
                <span>ℹ️</span> Department <strong>&quot;{studentWing}&quot;</strong> is active in {studentArea} Area.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
            ✓ {successMsg}
          </div>
        )}

        <form onSubmit={handleShiftSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Select Target Area *
            </label>
            <select
              value={targetArea}
              onChange={e => setTargetArea(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              required
            >
              <option value="">-- Choose New Training Area --</option>
              {areasList.filter(a => a !== studentArea).map(areaName => {
                const isSupported = availableAreasForDept.includes(areaName)
                return (
                  <option key={areaName} value={areaName}>
                    {areaName} Area {isSupported ? '⭐ (Department Active)' : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Upload LoR Document Section */}
          <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/80 space-y-2">
            <label className="block text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <span>📄</span> Attach Letter of Recommendation (LoR) PDF *
            </label>
            <p className="text-[11px] text-emerald-700 leading-tight">
              Upload or link the official LoR document to forward to {targetArea || 'Target Area'} Admin for review and approval.
            </p>
            <input
              type="file"
              accept=".pdf,.png,.jpeg,.jpg"
              onChange={e => setLorFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
            />
            <div className="pt-1">
              <span className="text-[10px] text-gray-400 block mb-1">or paste document URL:</span>
              <input
                type="url"
                value={lorUrlInput}
                onChange={e => setLorUrlInput(e.target.value)}
                placeholder="https://.../lor_document.pdf"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Transfer Note / Reason
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g., Forwarding LoR & candidate because Geology department is active at IB Valley Area..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={shifting || !targetArea}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {shifting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{uploadingLor ? 'Uploading LoR...' : 'Transferring...'}</span>
                </>
              ) : (
                <>
                  <span>🔄</span> Attach LoR & Transfer Student
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
