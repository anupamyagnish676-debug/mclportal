'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function StudentMaterialsPage() {
  const supabase = createClient()
  const [materials, setMaterials] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: internship, error: intErr } = await supabase.from('internships').select('id').eq('student_id', user.id).maybeSingle()
      if (intErr) { setError(intErr.message); setLoading(false); return }
      if (!internship) { setLoading(false); return }

      const { data: mats, error: matsErr } = await supabase.from('materials').select('id, title, file_url, created_at').eq('internship_id', internship.id).order('created_at', { ascending: false })
      if (matsErr) { setError(matsErr.message); setLoading(false); return }
      setMaterials(mats || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Study Materials</h1>
      <p className="text-gray-500 text-sm mb-6">View and download materials uploaded by your mentor</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">Loading materials...</div>
      ) : !materials.length ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">No materials uploaded yet</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(m => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{m.title}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(m.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 font-medium text-sm"
                    >
                      Download ↓
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
