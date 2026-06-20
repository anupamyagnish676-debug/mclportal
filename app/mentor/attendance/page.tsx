'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MentorAttendancePage() {
  const supabase = createClient()
  const [interns, setInterns] = useState<any[]>([])
  const [selectedInternship, setSelectedInternship] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState<'present' | 'absent' | 'half-day'>('present')
  const [attendance, setAttendance] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error: err } = await supabase
        .from('internships')
        .select('id, start_date, end_date, student:profiles!internships_student_id_fkey(full_name)')
        .eq('mentor_id', user.id)
        .eq('is_active', true)
      if (err) { setError(err.message); return }
      setInterns(data || [])
      if (data?.length) {
        setSelectedInternship(data[0].id)
        const today = new Date().toISOString().split('T')[0]
        if (data[0].start_date && data[0].end_date) {
          if (today >= data[0].start_date && today <= data[0].end_date) {
            setDate(today)
          } else {
            setDate(data[0].start_date)
          }
        }
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedInternship) return
    const selected = interns.find(i => i.id === selectedInternship)
    if (selected?.start_date && selected?.end_date) {
      const today = new Date().toISOString().split('T')[0]
      if (today >= selected.start_date && today <= selected.end_date) {
        setDate(today)
      } else {
        setDate(selected.start_date)
      }
    }
    supabase.from('attendance').select('*').eq('internship_id', selectedInternship)
      .order('date', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setAttendance(data || [])
      })
  }, [selectedInternship])

  async function markAttendance() {
    setSaving(true)
    setError('')
    const selected = interns.find(i => i.id === selectedInternship)
    if (selected?.start_date && selected?.end_date) {
      if (date < selected.start_date || date > selected.end_date) {
        setError(`Date must be within the internship period: ${selected.start_date} to ${selected.end_date}`)
        setSaving(false)
        return
      }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setSaving(false); return }

    const { error: err } = await supabase.from('attendance').upsert({
      internship_id: selectedInternship,
      date,
      status,
      marked_by: user.id,
    }, { onConflict: 'internship_id,date' })

    if (err) {
      setError(err.message)
    } else {
      setMsg('Attendance saved!')
      const { data } = await supabase.from('attendance').select('*').eq('internship_id', selectedInternship).order('date', { ascending: false })
      setAttendance(data || [])
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const intern = interns.find(i => i.id === selectedInternship)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Attendance</h1>
      <p className="text-gray-500 text-sm mb-6">Mark daily attendance for your interns</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {!interns.length ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
          No active interns assigned to you yet.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Mark attendance</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intern</label>
                <select value={selectedInternship} onChange={e => setSelectedInternship(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {interns.map(i => <option key={i.id} value={i.id}>{i.student?.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  min={intern?.start_date || undefined}
                  max={intern?.end_date || undefined}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                {intern?.start_date && intern?.end_date && (
                  <p className="text-xs text-gray-400 mt-1">Internship period: {intern.start_date} to {intern.end_date}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="flex gap-2">
                  {(['present', 'absent', 'half-day'] as const).map(s => (
                    <button key={s} onClick={() => setStatus(s)}
                      className={`flex-1 py-2 rounded-lg text-sm capitalize border transition-colors ${
                        status === s
                          ? s === 'present' ? 'bg-green-600 text-white border-green-600'
                            : s === 'absent' ? 'bg-red-500 text-white border-red-500'
                            : 'bg-yellow-500 text-white border-yellow-500'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {msg && <p className="text-green-600 text-sm">{msg}</p>}
              <button onClick={markAttendance} disabled={saving || !selectedInternship}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save attendance'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Attendance log — {intern?.student?.full_name}</h2>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {!attendance.length ? (
                <p className="text-gray-400 text-sm text-center py-4">No records yet</p>
              ) : attendance.map(a => (
                <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-gray-50 text-sm">
                  <span className="text-gray-700">{a.date}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    a.status === 'present' ? 'bg-green-100 text-green-700' :
                    a.status === 'absent' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
