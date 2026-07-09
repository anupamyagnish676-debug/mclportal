'use client'
import { useState } from 'react'

interface DocumentRecord {
  id: string
  doc_type: string
  file_url: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  uploaded_at: string
}

interface DocumentUploadProps {
  initialDocuments: DocumentRecord[]
}

const DOC_TYPES = [
  { key: 'affidavit', label: 'Affidavit (Signed)', desc: 'Submit a scanned copy of your signed internship affidavit.' },
  { key: 'college_id', label: 'College ID Card', desc: 'Front side scan of your current college identity card.' },
  { key: 'bonafide', label: 'Bonafide Certificate', desc: 'Bonafide letter issued by your college/university registrar.' },
  { key: 'aadhaar', label: 'Aadhaar Card', desc: 'Scan of your Aadhaar Card.' },
  { key: 'photo', label: 'Passport Photo', desc: 'Recent professional passport size colour photograph.' }
]

export default function DocumentUpload({ initialDocuments }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string>('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, docType: string) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(prev => ({ ...prev, [docType]: true }))
    setError('')

    // Client-side file size validation (max 4MB to fit Vercel serverless payload limits)
    const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB
    if (file.size > MAX_FILE_SIZE) {
      setError(`File "${file.name}" is too large. Maximum size allowed is 4MB. Please compress the file and try again.`)
      setUploading(prev => ({ ...prev, [docType]: false }))
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('doc_type', docType)

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        if (res.status === 413) {
          throw new Error('File size is too large for the server. Please compress your image or PDF below 4MB.')
        }
        const contentType = res.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to upload document')
        } else {
          throw new Error('Upload failed due to a server error. Please verify the file size.')
        }
      }

      const data = await res.json()

      // Refresh list
      const listRes = await fetch('/api/documents')
      if (listRes.ok) {
        const contentType = listRes.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const listData = await listRes.json()
          if (listData.documents) {
            setDocuments(listData.documents)
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred during file upload')
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }))
    }
  }

  // Verification status counts
  const approvedDocs = documents.filter(d => d.status === 'approved')
  const totalRequired = DOC_TYPES.length
  const allVerified = approvedDocs.length === totalRequired

  return (
    <div className="space-y-6">
      {/* Banner */}
      {allVerified ? (
        <div className="bg-green-50 border border-green-150 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
            ✓
          </div>
          <div>
            <h3 className="font-bold text-green-800 text-sm">All Documents Verified</h3>
            <p className="text-xs text-green-700">All required documents have been reviewed and approved by HRD.</p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-150 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0">
            !
          </div>
          <div>
            <h3 className="font-bold text-amber-800 text-sm">{approvedDocs.length} / {totalRequired} Documents Verified</h3>
            <p className="text-xs text-amber-700">Please upload all required files. HRD will verify them shortly.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {/* Grid of Documents */}
      <div className="space-y-4">
        {DOC_TYPES.map((doc) => {
          const record = documents.find(d => d.doc_type === doc.key)
          const isUploading = !!uploading[doc.key]

          return (
            <div key={doc.key} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm">{doc.label}</h3>
                  {record && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize ${
                      record.status === 'approved' ? 'bg-green-50 text-green-700' :
                      record.status === 'rejected' ? 'bg-red-50 text-red-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {record.status === 'approved' ? 'Verified' : record.status === 'rejected' ? 'Rejected' : 'Under Review'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{doc.desc}</p>
                {record?.status === 'rejected' && (
                  <p className="text-[10px] text-red-500 font-medium mt-1">
                    <strong>Rejection Reason:</strong> {record.rejection_reason || 'Please upload a clear scan.'}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {record && (
                  <a
                    href={record.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-gray-600 underline font-medium"
                  >
                    View Upload
                  </a>
                )}

                {(!record || record.status === 'rejected' || record.status === 'pending') && (
                  <div className="relative">
                    <input
                      type="file"
                      id={`file-${doc.key}`}
                      disabled={isUploading}
                      onChange={(e) => handleFileChange(e, doc.key)}
                      className="hidden"
                    />
                    <label
                      htmlFor={`file-${doc.key}`}
                      className={`cursor-pointer px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 font-semibold text-xs rounded-xl transition-colors inline-block ${
                        isUploading ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {isUploading ? 'Uploading...' : record ? 'Re-upload' : 'Upload File'}
                    </label>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
