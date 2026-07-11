'use client'
import { useState } from 'react'
import { ShieldAlert, CheckCircle, Loader2, Upload } from 'lucide-react'

export default function BankDetailsForm({
  rejectionReason,
  onSuccess
}: {
  rejectionReason?: string | null
  onSuccess: () => void
}) {
  const [bankName, setBankName] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [confirmAccountNo, setConfirmAccountNo] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (accountNo !== confirmAccountNo) {
      setError('Account numbers do not match.')
      return
    }

    if (!file) {
      setError('Please upload a copy of your Cancelled Cheque or Bank Passbook.')
      return
    }

    // Limit file size to 4MB (Vercel payload limits)
    if (file.size > 4 * 1024 * 1024) {
      setError('File size must be less than 4MB.')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('bank_name', bankName)
      formData.append('bank_account_no', accountNo)
      formData.append('bank_ifsc_code', ifscCode)
      formData.append('file', file)

      const res = await fetch('/api/stipend/bank-details', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit bank details')
      }

      setSuccess(true)
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 max-w-xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Submit Bank Account Details</h2>
        <p className="text-gray-500 text-sm">
          Please provide your bank details below for stipend disbursement. Ensure the details match your official documents.
        </p>
      </div>

      {rejectionReason && (
        <div className="mb-6 bg-red-50 border border-red-150 rounded-xl p-4 flex gap-3 text-red-800">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="font-bold text-xs">Previous Details Rejected</p>
            <p className="text-xs text-red-700 mt-0.5"><strong>Reason:</strong> {rejectionReason}</p>
          </div>
        </div>
      )}

      {success ? (
        <div className="bg-green-50 border border-green-150 rounded-xl p-6 text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
          <h3 className="font-bold text-green-900 text-lg">Submission Successful</h3>
          <p className="text-green-700 text-xs max-w-md mx-auto">
            Your bank details and document have been submitted to the Finance Department. 
            You will be notified once they verify the details and configure your stipend settings.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Bank Name</label>
            <input
              type="text"
              required
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. State Bank of India"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Account Number</label>
              <input
                type="password"
                required
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                placeholder="Enter account number"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Confirm Account Number</label>
              <input
                type="text"
                required
                value={confirmAccountNo}
                onChange={(e) => setConfirmAccountNo(e.target.value)}
                placeholder="Confirm account number"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">IFSC Code</label>
            <input
              type="text"
              required
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
              placeholder="e.g. SBIN0001234"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Cancelled Cheque / Passbook Copy <span className="text-gray-400 font-normal">(Max 4MB, PDF/Image)</span>
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-green-500 transition-colors relative cursor-pointer bg-slate-50/50">
              <input
                type="file"
                required
                accept=".pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-700">
                {file ? file.name : 'Click to select or drag document here'}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Accepts PDF, PNG, JPG, or JPEG up to 4MB</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-150 rounded-xl px-4 py-2.5 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#166534] hover:bg-[#155e2f] text-white py-3 rounded-xl font-bold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting details...
              </>
            ) : (
              'Submit Bank Details'
            )}
          </button>
        </form>
      )}
    </div>
  )
}
