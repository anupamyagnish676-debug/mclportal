import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export const revalidate = 0 // always fetch fresh data

export default async function PublicVerificationPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()

  const { data: internship } = await supabase
    .from('internships')
    .select('id, start_date, end_date, serial_no, is_active, certificate_url, certificate_approved, student:profiles!internships_student_id_fkey(full_name, roll_no, university, wing)')
    .eq('id', params.id)
    .maybeSingle()

  if (!internship) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-150 p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto font-bold">
            ✗
          </div>
          <h1 className="text-xl font-bold text-gray-900">Verification Failed</h1>
          <p className="text-sm text-gray-500">
            The internship record ID could not be found or is invalid. Please verify the URL or QR code and try again.
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

  const { student } = internship as any
  const isCertified = internship.certificate_approved && internship.certificate_url

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-2xl w-full overflow-hidden">
        {/* Organization Header */}
        <div className="bg-[#166534] p-6 text-white flex items-center gap-4">
          <img src="/mcl-logo.jpg" alt="MCL Logo" className="w-12 h-12 object-contain bg-white rounded-lg p-1 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold">Mahanadi Coalfields Limited</h1>
            <p className="text-xs text-green-150 opacity-90">A Subsidiary of Coal India Limited</p>
            <p className="text-[10px] uppercase tracking-wider text-green-200 mt-1 font-semibold">Official Credential Verification</p>
          </div>
        </div>

        {/* Verification Alert Badge */}
        <div className="p-6 border-b border-gray-100 flex flex-col items-center text-center space-y-2 bg-green-50/20">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-2xl font-bold">
            ✓
          </div>
          <h2 className="text-base font-bold text-green-800">Credential Authenticity Verified</h2>
          <p className="text-xs text-gray-500 max-w-sm">
            This page confirms that the individual listed below has completed or is currently undergoing an official internship at Mahanadi Coalfields Limited.
          </p>
        </div>

        {/* Intern Information Details */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Candidate Name</span>
              <p className="font-semibold text-gray-900 mt-0.5">{student?.full_name || 'N/A'}</p>
            </div>
            
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Internship Serial Number</span>
              <p className="font-bold text-green-700 mt-0.5">MCL/INT/{internship.serial_no || '42'}</p>
            </div>

            {student?.roll_no && (
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Roll Number</span>
                <p className="font-semibold text-gray-800 mt-0.5">{student.roll_no}</p>
              </div>
            )}

            {student?.university && (
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">University / College</span>
                <p className="font-semibold text-gray-800 mt-0.5">{student.university}</p>
              </div>
            )}

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Training Wing / Department</span>
              <p className="font-semibold text-gray-800 mt-0.5">{student?.wing || 'N/A'}</p>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Training Location</span>
              <p className="font-semibold text-gray-800 mt-0.5">Talcher Area, MCL</p>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Internship Period</span>
              <p className="font-semibold text-gray-800 mt-0.5">
                {internship.start_date} to {internship.end_date}
              </p>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Certificate Status</span>
              <p className="mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold capitalize
                  ${isCertified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {isCertified ? 'Issued & Approved' : 'In Progress / Pending'}
                </span>
              </p>
            </div>
          </div>

          {/* Certificate Download Link (If issued) */}
          {isCertified && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-150 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-gray-700">Official Internship Certificate</p>
                <p className="text-[10px] text-gray-400">Verified digital certificate generated by HRD department.</p>
              </div>
              <a
                href={internship.certificate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                View Certificate
              </a>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-gray-50 border-t border-gray-100 p-4 text-center">
          <p className="text-[10px] text-gray-400">
            MCL Internship Verification System. For additional inquiries, please contact GM (HRD), MCL HQ.
          </p>
        </div>
      </div>
    </div>
  )
}
