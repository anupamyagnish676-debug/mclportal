'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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
    employee_code: ''
  })
  const [adminProfile, setAdminProfile] = useState<{ role: string; area: string | null } | null>(null)
  const [areas, setAreas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
          // If local Area Admin, auto-bind user's area to local admin's area
          if (data.area && data.area !== 'Headquarters') {
            setForm(prev => ({ ...prev, area: data.area || '' }))
          }
        }
      }
    }
    loadAdmin()
    loadAreas()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // For Headquarters admins, require selecting an area
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
          area: adminProfile?.area !== 'Headquarters' ? (adminProfile?.area || '') : ''
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
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Create User</h1>
      <p className="text-gray-500 text-sm mb-6">Add a new student, mentor, employee, or admin to the portal</p>

      <div className="bg-white rounded-xl border border-gray-100 p-6">
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
              <select value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wing / Department</label>
            <input value={form.wing} onChange={e => setForm({ ...form, wing: e.target.value })}
              placeholder="e.g. Electrical, Civil, Mining"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

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
    </div>
  )
}
