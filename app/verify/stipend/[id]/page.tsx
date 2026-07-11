import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export const revalidate = 0

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'N/A'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } catch (e) {
    return dateStr
  }
}

export default async function StipendVerificationPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()

  // Fetch stipend payment details
  const { data: payment } = await supabase
    .from('stipend_payments')
    .select(`
      id,
      period_label,
      amount,
      status,
      remarks,
      disbursed_at,
      internship:internships(
        id,
        serial_no,
        area,
        bank_name,
        bank_account_no,
        student:profiles!internships_student_id_fkey(full_name, university, wing)
      )
    `)
    .eq('id', params.id)
    .maybeSingle() as { data: any }

  if (!payment || payment.status !== 'disbursed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto font-bold">
            ✗
          </div>
          <h1 className="text-xl font-bold text-gray-900">Verification Failed</h1>
          <p className="text-sm text-gray-500">
            This stipend payout advice could not be verified. It may be invalid, tampered with, or the disbursement has not been finalized yet.
          </p>
          <div className="pt-2">
            <Link href="/login" className="text-sm font-semibold text-green-600 hover:text-green-700">
              Go to Portal Login →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const student = payment.internship?.student
  const lastFour = payment.internship?.bank_account_no ? payment.internship.bank_account_no.slice(-4) : '****'
  const areaText = payment.internship?.area === 'Headquarters'
    ? 'MCL Headquarters, Sambalpur'
    : `${payment.internship?.area || 'Talcher'} Area, MCL`

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-2xl w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#0f4f2a] p-6 text-white flex items-center gap-4">
          <img src="/mcl-logo.jpg" alt="MCL Logo" className="w-12 h-12 object-contain bg-white rounded-lg p-1 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold">Mahanadi Coalfields Limited</h1>
            <p className="text-xs opacity-80">A Subsidiary of Coal India Limited</p>
            <p className="text-[10px] uppercase tracking-wider text-green-300 mt-1 font-semibold">Official Stipend Payout Verification</p>
          </div>
        </div>

        {/* Verification Status */}
        <div className="p-6 border-b border-gray-100 flex flex-col items-center text-center space-y-2 bg-green-50/30">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl font-bold shadow-inner">
            ✓
          </div>
          <h2 className="text-base font-bold text-green-800">Stipend Pay Advice Verified</h2>
          <p className="text-xs text-gray-500 max-w-sm">
            This pay advice document has been electronically verified and disbursed by the MCL Finance Department.
          </p>
        </div>

        {/* Transaction Details */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm border-b border-gray-100 pb-4">
            <div>
              <p className="text-xs text-gray-400">Intern Name</p>
              <p className="font-semibold text-gray-800">{student?.full_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Internship Serial ID</p>
              <p className="font-semibold text-gray-800">MCL/HRD/INT/{payment.internship?.serial_no || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-b border-gray-100 pb-4">
            <div>
              <p className="text-xs text-gray-400">University / College</p>
              <p className="font-medium text-gray-700">{student?.university || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Department & Area</p>
              <p className="font-medium text-gray-700">{student?.wing || 'N/A'} - {areaText}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-b border-gray-100 pb-4">
            <div>
              <p className="text-xs text-gray-400">Disbursement Period</p>
              <p className="font-semibold text-gray-800">{payment.period_label || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Amount Disbursed</p>
              <p className="font-bold text-green-700">₹{payment.amount?.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm pb-2">
            <div>
              <p className="text-xs text-gray-400">Bank Details</p>
              <p className="font-medium text-gray-700">{payment.internship?.bank_name || 'N/A'} (A/C ****{lastFour})</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Transaction Ref (UTR)</p>
              <p className="font-semibold text-gray-800">{payment.remarks || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
            <div>
              <p className="text-xs text-gray-400">Clearance Date</p>
              <p className="font-medium text-gray-700">{formatDate(payment.disbursed_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Advice Reference ID</p>
              <p className="font-mono text-xs text-gray-600 break-all">{payment.id}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
          <span className="text-[10px] text-gray-400">© 2026 Mahanadi Coalfields Limited</span>
          <Link href="/login" className="text-xs font-semibold text-green-700 hover:underline">
            Portal Login
          </Link>
        </div>

      </div>
    </div>
  )
}
