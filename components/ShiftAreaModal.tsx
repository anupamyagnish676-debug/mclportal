'use client'
import { useState, useEffect } from 'react'

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
  const [areasList, setAreasList] = useState<string[]>([
    'Talcher', 'Jagannath', 'Lingaraj', 'Subhadra', 'IB Valley', 'Lakhanpur', 'Orient', 'Basundhara', 'MCL HQ', 'Headquarters'
  ])
  const [deptAvailabilityMap, setDeptAvailabilityMap] = useState<Record<string, string[]>>({})
  const [targetArea, setTargetArea] = useState<string>('')
  const [reason, setReason] = useState<string>('')
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
      const res = await fetch('/api/admin/shift-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student?.id,
          targetArea,
          reason: reason.trim() || `Department "${studentWing}" is better suited for ${targetArea} Area.`
        })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(`Student ${student?.full_name} transferred to ${targetArea} Area successfully!`)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1200)
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
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-gray-100 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>🔄</span> Transfer Student Area
            </h2>
            <p className="text-xs text-gray-500">Shift candidate to another training area office</p>
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

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Transfer Note / Reason
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g., Shifted because Geology department is only available at IB Valley Area..."
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
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <span>🔄</span> Confirm Area Transfer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
