'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ShiftAreaModal from '@/components/ShiftAreaModal'

export default function CreateUserPage() {
  const supabase = createClient()
  const [form, setForm] = useState({ 
    full_name: '', 
    email: '', 
    password: '', 
    role: 'student', 
    wing: '', 
    start_date: '', 
    end_date: '', 
    roll_no: '', 
    university: '', 
    serial_no: '',
    area: '',
    employee_code: '',
    internship_type: 'unpaid'
  })
  const [adminProfile, setAdminProfile] = useState<{ role: string; area: string | null } | null>(null)
  const [areas, setAreas] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [deptAvailabilityMap, setDeptAvailabilityMap] = useState<Record<string, string[]>>({})
  const [areaStatusMap, setAreaStatusMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Shift Area Modal state for forwarding candidate with LoR
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [shiftCandidate, setShiftCandidate] = useState<any>(null)

  useEffect(() => {
    async function loadAreas() {
      try {
        const res = await fetch('/api/areas')
        const data = await res.json()
        if (res.ok) {
          setAreas(data.areas || [])
        }
      } catch (err) {
        console.error('Failed to load areas:', err)
      }
    }

    async function loadAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role, area')
          .eq('id', user.id)
          .maybeSingle()
        
        if (data) {
          setAdminProfile(data)
          const targetArea = (data.area && data.area !== 'Headquarters') ? data.area : 'Headquarters'
          setForm(prev => ({ ...prev, area: targetArea }))
          fetchDepartments(targetArea)
        }
      }
    }

    loadAdmin()
    loadAreas()
  }, [])

  async function fetchDepartments(targetArea: string) {
    try {
      const res = await fetch(`/api/admin/area-departments?area=${encodeURIComponent(targetArea)}`)
      const data = await res.json()
      if (res.ok) {
        setDepartments(data.departments || [])
        setDeptAvailabilityMap(data.deptAvailabilityMap || {})
        setAreaStatusMap(data.areaStatusMap || {})
      }
    } catch (err) {
      console.error('Failed to load area departments:', err)
    }
  }

  function handleAreaChange(newArea: string) {
    setForm(prev => ({ ...prev, area: newArea }))
    fetchDepartments(newArea)
  }

  const selectedAreaName = form.area || adminProfile?.area || 'Headquarters'
  const activeAreasForWing = form.wing ? (deptAvailabilityMap[form.wing] || []) : []
  const statusInArea = form.wing ? areaStatusMap[form.wing] : undefined
  const isWingActiveInCurrentArea = form.wing 
    ? (statusInArea !== undefined ? statusInArea : (activeAreasForWing.length === 0 || activeAreasForWing.includes(selectedAreaName)))
    : true

  function openForwardLoRModal() {
    if (!form.full_name || !form.email) {
      setMessage({ type: 'error', text: 'Please fill candidate Full Name and Email address first before forwarding LoR.' })
      return
    }
    setShiftCandidate({
      id: '',
      full_name: form.full_name,
      email: form.email,
      wing: form.wing,
      area: selectedAreaName,
      roll_no: form.roll_no,
      university: form.university
    })
    setShiftModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (adminProfile?.area === 'Headquarters' && !form.area) {
      setMessage({ type: 'error', text: 'Please select an Office / Area Location' })
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: `User created! Login: ${form.email} / ${form.password}` })
        setForm({ 
          full_name: '', 
          email: '', 
          password: '', 
          role: 'student', 
          wing: '', 
          start_date: '', 
          end_date: '', 
          roll_no: '', 
          university: '', 
          serial_no: '',
          employee_code: '',
          area: adminProfile?.area !== 'Headquarters' ? (adminProfile?.area || '') : '',
          internship_type: 'unpaid'
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create user' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
    setLoading(false)
  }

  return (
    <div className="max-w-xl pb-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Create User &amp; Forward Referral</h1>
      <p className="text-gray-500 text-sm mb-6">Add a new student, mentor, employee, or forward an LoR referral to an active Area</p>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="student">Student</option>
                <option value="mentor">Mentor</option>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
                <option value="finance">Finance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary password</label>
            <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Min 6 characters"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
          </div>

          {adminProfile?.area === 'Headquarters' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office / Area Location <span className="text-red-500">*</span></label>
              <select value={form.area} onChange={e => handleAreaChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required>
                <option value="">-- Select Area --</option>
                {areas.map(a => (
                  <option key={a.name} value={a.name}>
                    {a.name === 'Headquarters' ? 'Headquarters (Central)' : `${a.name} Area`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.role === 'employee' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code</label>
              <input value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })}
                placeholder="e.g. EMP12345"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            </div>
          )}

          {/* Wing / Department Dropdown with Smart Area Detection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Wing / Department</label>
              <span className="text-[11px] text-gray-400">Available in {selectedAreaName} Area</span>
            </div>

            <select
              value={form.wing}
              onChange={e => setForm({ ...form, wing: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
            >
              <option value="">-- Select Wing / Department --</option>
              {departments.map(dept => {
                const activeAreas = deptAvailabilityMap[dept.name] || []
                const statusInArea = areaStatusMap[dept.name]
                const isActiveInCurrentArea = statusInArea !== undefined ? statusInArea : (activeAreas.length === 0 || activeAreas.includes(selectedAreaName))

                return (
                  <option key={dept.id || dept.name} value={dept.name}>
                    {dept.name} {isActiveInCurrentArea 
                      ? `⭐ (Active in ${selectedAreaName})` 
                      : `🔒 (Not Active in ${selectedAreaName}${activeAreas.length > 0 ? ` — Active in: ${activeAreas.join(', ')}` : ''})`
                    }
                  </option>
                )
              })}
            </select>
          </div>

          {/* Smart Department Warning & Forward LoR Page Modal Option */}
          {form.wing && !isWingActiveInCurrentArea && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 space-y-2.5 animate-in fade-in duration-200">
              <div>
                <p className="font-bold flex items-center gap-1.5 text-amber-950 text-xs">
                  <span>⚠️</span> Department &quot;{form.wing}&quot; is NOT active in {selectedAreaName} Area.
                </p>
                {activeAreasForWing.length > 0 ? (
                  <p className="text-[11px] text-emerald-800 font-medium mt-1">
                    ✅ Active &amp; Operational in: <span className="underline font-bold">{activeAreasForWing.join(', ')}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500 italic mt-1">
                    No Area has enabled this department yet.
                  </p>
                )}
              </div>

              <div className="pt-1 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] text-amber-800">
                  Forward candidate &amp; attach LoR to target area admin inbox:
                </span>
                <button
                  type="button"
                  onClick={openForwardLoRModal}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 flex-shrink-0"
                >
                  <span>📄</span> Attach LoR &amp; Send to Active Area Modal ↗
                </button>
              </div>
            </div>
          )}

          {form.role === 'student' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                  <input value={form.roll_no} onChange={e => setForm({ ...form, roll_no: e.target.value })}
                    placeholder="e.g. 2021CSE045"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">University / College</label>
                  <input value={form.university} onChange={e => setForm({ ...form, university: e.target.value })}
                    placeholder="e.g. IIT Kharagpur"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internship Category</label>
                <select value={form.internship_type} onChange={e => setForm({ ...form, internship_type: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="unpaid">Unpaid Internship</option>
                  <option value="paid">Paid Internship</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Internship start</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Internship end</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
            </>
          )}

          {message && (
            <div className={`px-3 py-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create user'}
          </button>
        </form>
      </div>

      {/* Shift Area Modal with LoR Upload for Forwarding Candidate */}
      <ShiftAreaModal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        student={shiftCandidate}
        onSuccess={() => {
          setMessage({
            type: 'success',
            text: `Candidate ${shiftCandidate?.full_name} & LoR PDF successfully forwarded to Target Area Admin Inbox!`
          })
          setForm({ 
            full_name: '', 
            email: '', 
            password: '', 
            role: 'student', 
            wing: '', 
            start_date: '', 
            end_date: '', 
            roll_no: '', 
            university: '', 
            serial_no: '',
            employee_code: '',
            area: adminProfile?.area !== 'Headquarters' ? (adminProfile?.area || '') : '',
            internship_type: 'unpaid'
          })
        }}
      />
    </div>
  )
}
