'use client'
import { useState } from 'react'

interface Student {
  id: string
  full_name: string
  email: string
  area: string
}

interface DocumentRecord {
  id: string
  student_id: string
  doc_type: string
  file_url: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  uploaded_at: string
}

interface DocumentVerifierProps {
  students: Student[]
  initialDocuments: DocumentRecord[]
}

const DOC_TYPES = [
  { key: 'affidavit', label: 'Affidavit' },
  { key: 'college_id', label: 'College ID' },
  { key: 'bonafide', label: 'Bonafide' },
  { key: 'aadhaar', label: 'Aadhaar' },
  { key: 'photo', label: 'Photo' }
]

export default function DocumentVerifier({ students, initialDocuments }: DocumentVerifierProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  
  // Rejection input state
  const [rejectionDocId, setRejectionDocId] = useState<string | null>(null)
  const [reason, setReason] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // Map students with verification counts
  const studentItems = students.map(s => {
    const sDocs = documents.filter(d => d.student_id === s.id)
    const approved = sDocs.filter(d => d.status === 'approved').length
    const pending = sDocs.filter(d => d.status === 'pending').length
    const statusLabel = approved === 5 ? 'All Verified' : `${approved}/5 Verified`
    return { ...s, approvedCount: approved, pendingCount: pending, statusLabel }
  })

  // Get selected student details
  const selectedStudent = students.find(s => s.id === selectedStudentId)
  const selectedDocs = documents.filter(d => d.student_id === selectedStudentId)

  async function handleVerify(docId: string, status: 'approved' | 'rejected', rejectReason?: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: docId,
          status,
          rejection_reason: rejectReason
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to verify document')

      setDocuments(prev => prev.map(d => {
        if (d.id === docId) {
          return { ...d, status, rejection_reason: rejectReason || null }
        }
        return d
      }))
      setRejectionDocId(null)
      setReason('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Students List */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 p-4 space-y-2 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-2 mb-2">Student Directory</h3>
        <div className="space-y-1 overflow-y-auto max-h-[500px]">
          {studentItems.map((s) => {
            const isSelected = selectedStudentId === s.id
            const isDone = s.approvedCount === 5
            return (
              <button
                key={s.id}
                onClick={() => setSelectedStudentId(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative ${
                  isSelected
                    ? 'bg-green-50 text-green-700 font-semibold border-l-4 border-green-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="truncate block font-medium max-w-[140px]">{s.full_name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    isDone ? 'bg-green-100 text-green-700' :
                    s.pendingCount > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {s.statusLabel}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 block mt-0.5">{s.area} Area</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Verification Pane */}
      <div className="lg:col-span-2 space-y-6">
        {selectedStudent ? (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-900">Document Verification Review</h2>
              <p className="text-xs text-gray-500 mt-1">Review student submitted credentials for candidate: <strong>{selectedStudent.full_name}</strong> ({selectedStudent.email})</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            {/* Document Types */}
            <div className="space-y-4">
              {DOC_TYPES.map((type) => {
                const doc = selectedDocs.find(d => d.doc_type === type.key)
                const isRejectionInput = rejectionDocId === doc?.id

                return (
                  <div key={type.key} className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">{type.label}</h4>
                        {doc ? (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide mt-1 inline-block ${
                            doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                            doc.status === 'rejected' ? 'bg-red-150 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {doc.status}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300 italic mt-1 block">Not uploaded yet</span>
                        )}
                      </div>

                      {doc && (
                        <div className="flex items-center gap-3">
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-700 hover:text-green-800 font-semibold underline"
                          >
                            Preview File
                          </a>

                          {doc.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setRejectionDocId(doc.id)}
                                className="text-[11px] font-bold text-red-600 px-2.5 py-1 border border-red-200 hover:bg-red-50 rounded-lg"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleVerify(doc.id, 'approved')}
                                className="text-[11px] font-bold text-white bg-green-700 px-2.5 py-1 hover:bg-green-800 rounded-lg"
                              >
                                Verify / Approve
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Rejection input box */}
                    {isRejectionInput && (
                      <div className="bg-white p-3 rounded-xl border border-gray-150 space-y-2 mt-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Provide rejection reason (Will be emailed to student)</label>
                        <input
                          type="text"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g. Scanned copy is blur, please submit a high-quality scan..."
                          className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-white focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setRejectionDocId(null)}
                            className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-500"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleVerify(doc.id, 'rejected', reason)}
                            disabled={saving}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
                          >
                            {saving ? 'Rejecting...' : 'Reject & Email'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-gray-150 text-center text-gray-400 text-sm italic">
            Select a student from the directory to review and verify their onboarding documents.
          </div>
        )}
      </div>
    </div>
  )
}
