'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function StudentAssignmentsPage() {
  const supabase = createClient()
  const [assignments, setAssignments] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<Record<string, any>>({})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: internship, error: intErr } = await supabase.from('internships').select('id').eq('student_id', user.id).maybeSingle()
      if (intErr) { setError(intErr.message); return }
      if (!internship) return

      const { data: asgn, error: asgnErr } = await supabase.from('assignments').select('*').eq('internship_id', internship.id).order('created_at', { ascending: false })
      if (asgnErr) { setError(asgnErr.message); return }
      setAssignments(asgn || [])

      const { data: subs } = await supabase.from('submissions').select('*').eq('student_id', user.id)
      const subMap: Record<string, any> = {}
      subs?.forEach(s => { subMap[s.assignment_id] = s })
      setSubmissions(subMap)
    }
    load()
  }, [])

  async function submitAssignment(assignmentId: string) {
    const file = files[assignmentId]
    if (!file) return
    setUploading(assignmentId)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setUploading(null); return }

    const filePath = `${user.id}/${assignmentId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('assignments').upload(filePath, file)
    if (uploadError) { setError(uploadError.message); setUploading(null); return }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from('assignments').createSignedUrl(filePath, 60 * 60 * 24 * 365)
    if (signedUrlError) { setError(signedUrlError.message); setUploading(null); return }

    const { data: sub, error: insertError } = await supabase.from('submissions').insert({
      assignment_id: assignmentId,
      student_id: user.id,
      file_url: signedUrlData.signedUrl,
    }).select().single()

    if (insertError) {
      setError(insertError.message)
    } else {
      setSubmissions({ ...submissions, [assignmentId]: sub })
      setMsg({ ...msg, [assignmentId]: 'Submitted!' })
    }
    setUploading(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Assignments</h1>
      <p className="text-gray-500 text-sm mb-6">View and submit your assignments</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      <div className="space-y-4">
        {!assignments.length ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">No assignments yet</div>
        ) : assignments.map(a => {
          const submitted = submissions[a.id]
          const isOverdue = a.due_date && new Date(a.due_date) < new Date() && !submitted
          return (
            <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                {submitted
                  ? <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Submitted ✓</span>
                  : isOverdue
                  ? <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">Overdue</span>
                  : <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Pending</span>
                }
              </div>
              {a.description && <p className="text-sm text-gray-500 mb-3">{a.description}</p>}
              {a.due_date && <p className="text-xs text-gray-400 mb-3">Due: {a.due_date}</p>}
              {!submitted ? (
                <div className="flex items-center gap-2 mt-3">
                  <input type="file" onChange={e => setFiles({ ...files, [a.id]: e.target.files![0] })}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 flex-1" />
                  <button onClick={() => submitAssignment(a.id)} disabled={!files[a.id] || uploading === a.id}
                    className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                    {uploading === a.id ? 'Uploading...' : 'Submit'}
                  </button>
                </div>
              ) : (
                <a href={submitted.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View your submission →</a>
              )}
              {msg[a.id] && <p className="text-green-600 text-xs mt-1">{msg[a.id]}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
