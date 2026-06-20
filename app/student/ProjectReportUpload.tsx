'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProjectReportUpload({
  internshipId,
  currentReportUrl,
  currentProjectTitle
}: {
  internshipId: string
  currentReportUrl: string | null
  currentProjectTitle: string | null
}) {
  const supabase = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [reportUrl, setReportUrl] = useState<string | null>(currentReportUrl)
  const [projectTitle, setProjectTitle] = useState<string>(currentProjectTitle || '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !projectTitle.trim()) return
    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const filePath = `project-reports/${internshipId}/${Date.now()}_${file.name}`
      
      // 1. Upload to Supabase Storage in 'assignments' bucket
      const { error: uploadErr } = await supabase.storage
        .from('assignments')
        .upload(filePath, file)

      if (uploadErr) {
        setError(uploadErr.message)
        setUploading(false)
        return
      }

      // 2. Generate long-lived signed URL
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('assignments')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10) // 10 years

      if (signedErr) {
        setError(signedErr.message)
        setUploading(false)
        return
      }

      const fileUrl = signedData.signedUrl
      const today = new Date().toISOString().split('T')[0]

      // 3. Update 'internships' table
      const { error: dbErr } = await supabase
        .from('internships')
        .update({ 
          project_report_url: fileUrl,
          project_title: projectTitle,
          project_submitted_at: today
        })
        .eq('id', internshipId)

      if (dbErr) {
        setError(dbErr.message)
      } else {
        setReportUrl(fileUrl)
        setSuccess('Final project report uploaded successfully!')
        setFile(null)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload.')
    }
    setUploading(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mt-6 shadow-sm">
      <h3 className="font-bold text-gray-800 text-sm mb-3">Final Project Report</h3>
      <p className="text-xs text-gray-500 mb-4 leading-normal">
        Submit your final internship report PDF and title. Your mentor and HRD department will review this prior to certificate issuance.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs mb-3">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-xs mb-3">
          {success}
        </div>
      )}

      {reportUrl && (
        <div className="mb-4 bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Uploaded ✓</span>
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              View Submitted PDF →
            </a>
          </div>
          {projectTitle && (
            <div className="mt-2 pt-2 border-t border-gray-150/50">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Project Title</p>
              <p className="text-xs font-semibold text-gray-700 mt-0.5">{projectTitle}</p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Project Report Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Performance Analysis of Coal Handling Plants"
            value={projectTitle}
            onChange={e => setProjectTitle(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50/50"
            required
            disabled={uploading}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Report PDF File <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="file"
              accept=".pdf"
              onChange={e => {
                const f = e.target.files?.[0] || null
                setFile(f)
              }}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              required
              disabled={uploading}
            />
            <button
              type="submit"
              disabled={uploading || !file || !projectTitle.trim()}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {uploading ? 'Uploading...' : reportUrl ? 'Update Report' : 'Upload Report'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
