'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function EmployeeReviewPage() {
  const supabase = createClient()
  const [applications, setApplications] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [studentEmail, setStudentEmail] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error: err } = await supabase
        .from('applications')
        .select('*, student:profiles!applications_student_id_fkey(full_name, email)')
        .eq('referred_by', user.id)
        .order('applied_at', { ascending: false })
      if (err) { setError(err.message); return }
      setApplications(data || [])
    }
    load()
  }, [])

  async function submitLoR() {
    if (!file || !studentEmail) return
    setUploading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setUploading(false); return }

    const { data: student, error: studentError } = await supabase
      .from('profiles').select('id').eq('email', studentEmail).eq('role', 'student').maybeSingle()

    if (studentError) { setError(studentError.message); setUploading(false); return }
    if (!student) { setError('Student email not found — they must already have a portal account with role=student.'); setUploading(false); return }

    const filePath = `${student.id}/${Date.now()}_lor.pdf`
    const { error: uploadError } = await supabase.storage.from('lor-documents').upload(filePath, file)
    if (uploadError) { setError(uploadError.message); setUploading(false); return }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from('lor-documents').createSignedUrl(filePath, 60 * 60 * 24 * 365)
    if (signedUrlError) { setError(signedUrlError.message); setUploading(false); return }

    const { error: insertError } = await supabase.from('applications').insert({
      student_id: student.id,
      referred_by: user.id,
      lor_url: signedUrlData.signedUrl,
      status: 'pending',
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setMsg('LoR submitted to admin!')
      setFile(null)
      setStudentEmail('')
      const { data } = await supabase.from('applications').select('*, student:profiles!applications_student_id_fkey(full_name, email)').eq('referred_by', user.id).order('applied_at', { ascending: false })
      setApplications(data || [])
      setTimeout(() => setMsg(''), 4000)
    }
    setUploading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Review LoR</h1>
      <p className="text-gray-500 text-sm mb-6">Submit Letter of Recommendation to admin for review</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Submit new LoR</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student email (must already have a portal account)</label>
              <input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LoR PDF from college</label>
              <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            {msg && <p className="text-green-600 text-sm">{msg}</p>}
            <button onClick={submitLoR} disabled={uploading || !file || !studentEmail}
              className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              {uploading ? 'Submitting...' : 'Submit to admin'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Your submissions</h2>
          {!applications.length ? <p className="text-gray-400 text-sm text-center py-4">No submissions yet</p> :
            <div className="space-y-2">
              {applications.map(a => (
                <div key={a.id} className="p-3 border border-gray-100 rounded-lg">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm text-gray-900">{a.student?.full_name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      a.status === 'approved' ? 'bg-green-100 text-green-700' :
                      a.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{a.status}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(a.applied_at).toLocaleDateString('en-IN')}</p>
                </div>
              ))}
            </div>}
        </div>
      </div>
    </div>
  )
}
