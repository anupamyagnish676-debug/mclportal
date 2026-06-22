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
  const [studentName, setStudentName] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [rollNo, setRollNo] = useState('')
  const [university, setUniversity] = useState('')

  async function loadSubmissions() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch user profile to get their default employee code
    const { data: prof } = await supabase.from('profiles').select('employee_code').eq('id', user.id).maybeSingle()
    if (prof?.employee_code) {
      setEmployeeCode(prof.employee_code)
    }

    const { data, error: err } = await supabase
      .from('applications')
      .select('*, student:profiles!applications_student_id_fkey(full_name, email)')
      .eq('referred_by', user.id)
      .order('applied_at', { ascending: false })
    if (err) { 
      setError(err.message)
      return 
    }
    setApplications(data || [])
  }

  useEffect(() => {
    loadSubmissions()
  }, [])

  async function submitLoR() {
    if (!file || !studentEmail || !studentName || !employeeCode || !rollNo || !university) return
    setUploading(true)
    setError('')
    setMsg('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { 
        setError('Not signed in')
        setUploading(false)
        return 
      }

      // 1. Upload file using a sanitized email folder path in storage
      const sanitizedEmail = studentEmail.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')
      const filePath = `lors/${sanitizedEmail}/${Date.now()}_lor.pdf`

      const { error: uploadError } = await supabase.storage.from('lor-documents').upload(filePath, file)
      if (uploadError) { 
        setError(`Storage Upload Error: ${uploadError.message}`)
        setUploading(false)
        return 
      }

      // 2. Create signed URL valid for 1 year
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('lor-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365)

      if (signedUrlError) { 
        setError(`Signed URL Generation Error: ${signedUrlError.message}`)
        setUploading(false)
        return 
      }

      // 3. Post to the secure backend API endpoint
      const res = await fetch('/api/employee/submit-lor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail: studentEmail.trim(),
          studentName: studentName.trim(),
          lorUrl: signedUrlData.signedUrl,
          employeeCode: employeeCode.trim(),
          rollNo: rollNo.trim(),
          university: university.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to submit LOR application')
      } else {
        setMsg('Letter of Recommendation submitted successfully to admin!')
        setFile(null)
        setStudentEmail('')
        setStudentName('')
        setRollNo('')
        setUniversity('')
        await loadSubmissions()
        setTimeout(() => setMsg(''), 5000)
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected connection error')
    }
    setUploading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Review LoR</h1>
      <p className="text-gray-500 text-sm mb-6">Submit Letter of Recommendation to admin for review</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-4">Submit new LoR</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Student Full Name</label>
              <input 
                type="text" 
                value={studentName} 
                onChange={e => setStudentName(e.target.value)}
                placeholder="e.g. Rahul Kumar"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" 
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Student Email Address</label>
              <input 
                type="email" 
                value={studentEmail} 
                onChange={e => setStudentEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" 
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Employee Code</label>
              <input 
                type="text" 
                value={employeeCode} 
                onChange={e => setEmployeeCode(e.target.value)}
                placeholder="e.g. EMP12345"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" 
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Student Roll Number</label>
              <input 
                type="text" 
                value={rollNo} 
                onChange={e => setRollNo(e.target.value)}
                placeholder="e.g. 2021CSE045"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" 
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">University / College</label>
              <input 
                type="text" 
                value={university} 
                onChange={e => setUniversity(e.target.value)}
                placeholder="e.g. NIT Rourkela"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" 
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">LoR PDF from College</label>
              <input 
                type="file" 
                accept=".pdf" 
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" 
                required
              />
            </div>

            {msg && <p className="text-green-600 text-sm font-semibold">{msg}</p>}

            <button 
              onClick={submitLoR} 
              disabled={uploading || !file || !studentEmail || !studentName || !employeeCode || !rollNo || !university}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Submitting...' : 'Submit to admin'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-4">Your Submissions</h2>
          {!applications.length ? (
            <p className="text-gray-400 text-sm text-center py-4">No submissions yet</p>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {applications.map(a => (
                <div key={a.id} className="p-3.5 border border-gray-100 rounded-lg hover:bg-gray-50/50 transition-colors">
                  <div className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{a.student?.full_name || 'Anonymous Student'}</p>
                      <p className="text-xs text-gray-400 truncate">{a.student?.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                      a.status === 'approved' ? 'bg-green-100 text-green-700' :
                      a.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {a.status === 'pending_hq' || a.status === 'pending' ? 'HQ Screening' :
                       a.status === 'pending_area' ? 'Area Review' :
                       a.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">Submitted on {new Date(a.applied_at).toLocaleDateString('en-IN')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
