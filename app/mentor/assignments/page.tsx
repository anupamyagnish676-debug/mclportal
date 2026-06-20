'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MentorAssignmentsPage() {
  const supabase = createClient()
  const [interns, setInterns] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [selectedInternship, setSelectedInternship] = useState('')
  const [form, setForm] = useState({ title: '', description: '', due_date: '' })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'create' | 'submissions'>('create')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error: err } = await supabase
        .from('internships')
        .select('id, student_id, student:profiles!internships_student_id_fkey(full_name)')
        .eq('mentor_id', user.id)
      if (err) { setError(err.message); return }
      setInterns(data || [])
      if (data?.length) setSelectedInternship(data[0].id)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedInternship) return
    const intern = interns.find(i => i.id === selectedInternship)
    Promise.all([
      supabase.from('assignments').select('*').eq('internship_id', selectedInternship).order('created_at', { ascending: false }),
      intern ? supabase.from('submissions').select('*, assignment:assignments(title)').eq('student_id', intern.student_id) : Promise.resolve({ data: [] }),
    ]).then(([a, s]) => {
      setAssignments(a.data || [])
      setSubmissions((s as any).data || [])
    })
  }, [selectedInternship, interns])

  async function createAssignment() {
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setSaving(false); return }

    const { error: err } = await supabase.from('assignments').insert({
      internship_id: selectedInternship,
      title: form.title,
      description: form.description,
      due_date: form.due_date || null,
      created_by: user.id,
    })

    if (err) {
      setError(err.message)
    } else {
      const { data } = await supabase.from('assignments').select('*').eq('internship_id', selectedInternship).order('created_at', { ascending: false })
      setAssignments(data || [])
      setForm({ title: '', description: '', due_date: '' })
    }
    setSaving(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Assignments</h1>
      <p className="text-gray-500 text-sm mb-4">Create assignments and review submissions</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {!interns.length ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">No interns assigned to you yet.</div>
      ) : (
        <>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mr-2">Intern:</label>
            <select value={selectedInternship} onChange={e => setSelectedInternship(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {interns.map(i => <option key={i.id} value={i.id}>{i.student?.full_name}</option>)}
            </select>
          </div>

          <div className="flex gap-2 mb-5">
            {(['create', 'submissions'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm capitalize ${tab === t ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'create' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-800 mb-4">New assignment</h2>
                <div className="space-y-3">
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Assignment title"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Description / instructions" rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                  <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <button onClick={createAssignment} disabled={saving || !form.title}
                    className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                    {saving ? 'Creating...' : 'Create assignment'}
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Existing assignments</h2>
                {!assignments.length ? <p className="text-gray-400 text-sm">None yet</p> :
                  <div className="space-y-2">
                    {assignments.map(a => (
                      <div key={a.id} className="p-3 border border-gray-100 rounded-lg">
                        <p className="font-medium text-sm text-gray-900">{a.title}</p>
                        <p className="text-xs text-gray-400">Due: {a.due_date || 'No deadline'}</p>
                      </div>
                    ))}
                  </div>}
              </div>
            </div>
          )}

          {tab === 'submissions' && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Student submissions</h2>
              {!submissions.length ? <p className="text-gray-400 text-sm text-center py-4">No submissions yet</p> :
                <div className="space-y-2">
                  {submissions.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{s.assignment?.title}</p>
                        <p className="text-xs text-gray-400">Submitted: {new Date(s.submitted_at).toLocaleDateString('en-IN')}</p>
                      </div>
                      {s.file_url && (
                        <a href={s.file_url} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                          View file
                        </a>
                      )}
                    </div>
                  ))}
                </div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
