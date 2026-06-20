'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MentorMaterialsPage() {
  const supabase = createClient()
  const [interns, setInterns] = useState<any[]>([])
  const [selectedInternship, setSelectedInternship] = useState('')
  const [materials, setMaterials] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error: err } = await supabase
        .from('internships')
        .select('id, student:profiles!internships_student_id_fkey(full_name)')
        .eq('mentor_id', user.id)
      if (err) { setError(err.message); return }
      setInterns(data || [])
      if (data?.length) setSelectedInternship(data[0].id)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedInternship) return
    supabase.from('materials').select('*').eq('internship_id', selectedInternship)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setMaterials(data || [])
      })
  }, [selectedInternship])

  async function uploadMaterial() {
    if (!file || !title) return
    setUploading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setUploading(false); return }

    const filePath = `${selectedInternship}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('study-materials').upload(filePath, file)

    if (uploadError) { setError(uploadError.message); setUploading(false); return }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('study-materials')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365)

    if (signedUrlError) { setError(signedUrlError.message); setUploading(false); return }

    const { error: insertError } = await supabase.from('materials').insert({
      internship_id: selectedInternship,
      title,
      file_url: signedUrlData.signedUrl,
      uploaded_by: user.id,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      const { data } = await supabase.from('materials').select('*').eq('internship_id', selectedInternship).order('created_at', { ascending: false })
      setMaterials(data || [])
      setTitle('')
      setFile(null)
      setMsg('Material uploaded!')
      setTimeout(() => setMsg(''), 3000)
    }
    setUploading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Study Materials</h1>
      <p className="text-gray-500 text-sm mb-6">Upload notes and resources for your interns</p>

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

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Upload material</h2>
              <div className="space-y-3">
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (e.g. Week 1 Notes)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                {msg && <p className="text-green-600 text-sm">{msg}</p>}
                <button onClick={uploadMaterial} disabled={uploading || !file || !title}
                  className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Uploaded materials</h2>
              {!materials.length ? <p className="text-gray-400 text-sm text-center py-4">No materials yet</p> :
                <div className="space-y-2">
                  {materials.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{m.title}</p>
                        <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString('en-IN')}</p>
                      </div>
                      <a href={m.file_url} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                        Download
                      </a>
                    </div>
                  ))}
                </div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
