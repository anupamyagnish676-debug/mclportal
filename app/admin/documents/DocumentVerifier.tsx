'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface Student {
  id: string
  full_name: string
  email: string
  area: string
  serial_no?: string | null
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

type AiResult = { status: 'idle' | 'loading' | 'matched' | 'mismatch' | 'error'; score: number | null; message: string }

export default function DocumentVerifier({ students, initialDocuments }: DocumentVerifierProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  
  // Rejection input state
  const [rejectionDocId, setRejectionDocId] = useState<string | null>(null)
  const [reason, setReason] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // AI KYC State (per selected student)
  const [aiResult, setAiResult] = useState<AiResult>({ status: 'idle', score: null, message: '' })
  const faceapiRef = useRef<any>(null)
  const [aiLoaded, setAiLoaded] = useState(false)

  // Load face-api.js models on mount
  useEffect(() => {
    async function loadModels() {
      try {
        const faceapi = await import('face-api.js')
        faceapiRef.current = faceapi
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ])
        setAiLoaded(true)
      } catch (err) {
        console.error('AI Models failed to load:', err)
      }
    }
    loadModels()
  }, [])

  // Run AI match for selected student
  const runAiForStudent = useCallback(async (studentId: string) => {
    if (!aiLoaded || !faceapiRef.current) {
      setAiResult({ status: 'idle', score: null, message: 'AI engine loading...' })
      return
    }

    const studentDocs = documents.filter(d => d.student_id === studentId)
    const aadhaarDoc = studentDocs.find(d => d.doc_type === 'aadhaar' && d.file_url)
    const photoDoc = studentDocs.find(d => d.doc_type === 'photo' && d.file_url)

    if (!aadhaarDoc || !photoDoc) {
      setAiResult({ status: 'idle', score: null, message: 'Aadhaar or Photo not uploaded yet.' })
      return
    }

    const faceapi = faceapiRef.current
    setAiResult({ status: 'loading', score: null, message: 'Analyzing faces...' })

    try {
      // Proxy images through our server to bypass CORS for canvas operations
      const proxyUrl = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`
      const aadhaarImg = await faceapi.fetchImage(proxyUrl(aadhaarDoc.file_url))
      const photoImg = await faceapi.fetchImage(proxyUrl(photoDoc.file_url))

      const aadhaarFace = await faceapi.detectSingleFace(aadhaarImg).withFaceLandmarks().withFaceDescriptor()
      const photoFace = await faceapi.detectSingleFace(photoImg).withFaceLandmarks().withFaceDescriptor()

      if (!aadhaarFace || !photoFace) {
        setAiResult({ status: 'error', score: null, message: 'Could not detect a face in one of the images. Manual verification required.' })
        return
      }

      const distance = faceapi.euclideanDistance(aadhaarFace.descriptor, photoFace.descriptor)
      const confidence = Math.max(0, Math.round((1 - distance) * 100))

      if (distance < 0.6) {
        setAiResult({ status: 'matched', score: confidence, message: `Faces match (${confidence}% confidence)` })
      } else {
        setAiResult({ status: 'mismatch', score: confidence, message: `Faces may NOT match (${confidence}% confidence). Please review carefully.` })
      }
    } catch (err) {
      console.error('AI KYC Error:', err)
      setAiResult({ status: 'error', score: null, message: 'AI could not process images. Please verify manually.' })
    }
  }, [aiLoaded, documents])

  // Auto-run AI when student selection changes
  useEffect(() => {
    if (selectedStudentId) {
      setAiResult({ status: 'idle', score: null, message: '' })
      runAiForStudent(selectedStudentId)
    }
  }, [selectedStudentId, runAiForStudent])

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

  // Reject both aadhaar and photo (request re-upload for KYC mismatch)
  async function handleRejectKYC() {
    if (!selectedStudentId) return
    const studentDocs = documents.filter(d => d.student_id === selectedStudentId)
    const aadhaarDoc = studentDocs.find(d => d.doc_type === 'aadhaar')
    const photoDoc = studentDocs.find(d => d.doc_type === 'photo')
    const rejectReason = 'AI KYC Mismatch: Face on Aadhaar does not match Passport Photo. Please re-upload clear photos.'

    if (aadhaarDoc) await handleVerify(aadhaarDoc.id, 'rejected', rejectReason)
    if (photoDoc) await handleVerify(photoDoc.id, 'rejected', rejectReason)
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
                  <div className="truncate max-w-[140px]">
                    <span className="truncate block font-medium">{s.full_name}</span>
                    {s.serial_no && (
                      <span className="text-[9px] font-bold text-green-700 block">
                        MCL/HRD/INT/{s.serial_no}
                      </span>
                    )}
                  </div>
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
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Document Verification Review</h2>
                <p className="text-xs text-gray-500 mt-1">Review student submitted credentials for candidate: <strong>{selectedStudent.full_name}</strong> ({selectedStudent.email})</p>
              </div>
              {selectedStudent.serial_no && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                  MCL/HRD/INT/{selectedStudent.serial_no}
                </span>
              )}
            </div>

            {/* AI KYC Score Widget */}
            {(selectedDocs.find(d => d.doc_type === 'aadhaar') && selectedDocs.find(d => d.doc_type === 'photo')) && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                aiResult.status === 'matched' ? 'bg-green-50 border-green-200' :
                aiResult.status === 'mismatch' ? 'bg-red-50 border-red-200' :
                aiResult.status === 'error' ? 'bg-amber-50 border-amber-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                  aiResult.status === 'matched' ? 'bg-green-100' :
                  aiResult.status === 'mismatch' ? 'bg-red-100' :
                  'bg-gray-100'
                }`}>
                  🤖
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-gray-900">AI KYC Identity Screening</h4>
                    {aiResult.status === 'matched' && (
                      <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">✅ MATCH</span>
                    )}
                    {aiResult.status === 'mismatch' && (
                      <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">⚠️ MISMATCH</span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${
                    aiResult.status === 'matched' ? 'text-green-700' :
                    aiResult.status === 'mismatch' ? 'text-red-600' :
                    'text-gray-500'
                  }`}>
                    {aiResult.status === 'loading' ? '⏳ Analyzing faces...' :
                     aiResult.status === 'idle' ? (aiLoaded ? 'Processing...' : 'Loading AI Engine...') :
                     aiResult.message}
                  </p>
                  {aiResult.score !== null && (
                    <div className="mt-2 w-full max-w-xs">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${aiResult.score >= 60 ? 'bg-green-500' : aiResult.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${aiResult.score}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-gray-400 mt-0.5">Confidence: {aiResult.score}%</p>
                    </div>
                  )}
                  {/* Admin action: Reject & Request Re-upload for KYC Mismatch */}
                  {aiResult.status === 'mismatch' && (
                    <button
                      onClick={handleRejectKYC}
                      disabled={saving}
                      className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition-colors"
                    >
                      {saving ? 'Rejecting...' : 'Reject & Request Re-upload (KYC Mismatch)'}
                    </button>
                  )}
                </div>
              </div>
            )}

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

                          {/* Allow re-rejection even for approved docs */}
                          {doc.status === 'approved' && (
                            <button
                              onClick={() => setRejectionDocId(doc.id)}
                              className="text-[10px] font-bold text-red-500 px-2 py-0.5 border border-red-200 hover:bg-red-50 rounded-lg"
                            >
                              Revoke & Re-upload
                            </button>
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
                            onClick={() => handleVerify(doc!.id, 'rejected', reason)}
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
