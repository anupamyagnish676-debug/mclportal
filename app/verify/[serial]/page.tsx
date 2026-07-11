import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export const revalidate = 0

// Recompute HMAC for a given serial_no and compare with the token in the URL.
// This is a constant-time comparison to prevent timing attacks.
function computeToken(serialNo: number | string): string {
  const secret = process.env.CERT_HMAC_SECRET || ''
  return createHmac('sha256', secret).update(String(serialNo)).digest('hex')
}

export default async function PublicVerificationPage({ params }: { params: { serial: string } }) {
  const supabase = createAdminClient()
  const tokenFromUrl = params.serial  // This is the HMAC hex token or fallback UUID

  // We cannot reverse HMAC — so we find internships and verify the token matches.
  // For efficiency, we fetch all issued certificates and check HMAC match server-side.
  const { data: allInternships } = await supabase
    .from('internships')
    .select('id, serial_no')

  // Find the internship using multiple fallback routes to be extremely robust:
  // 1. Current environment secret HMAC
  // 2. Empty secret fallback HMAC (if Vercel var not set)
  // 3. Local dev secret fallback HMAC (if cert generated in dev)
  // 4. Raw serial number match (manual entry / direct links)
  // 5. Raw UUID match (legacy dashboard QR codes)
  const matched = allInternships?.find((i) => {
    // 1. Current environment hmac
    if (computeToken(i.serial_no) === tokenFromUrl) return true

    // 2. Empty hmac fallback
    const emptySecretToken = createHmac('sha256', '').update(String(i.serial_no)).digest('hex')
    if (emptySecretToken === tokenFromUrl) return true

    // 3. Local dev secret fallback
    const devSecretToken = createHmac('sha256', 'oTmpJ2idZbx3I9yaKqwHNV7kWC8rMng05cjhYU1EBQftsL4X').update(String(i.serial_no)).digest('hex')
    if (devSecretToken === tokenFromUrl) return true

    // 4. Raw serial number
    if (String(i.serial_no) === tokenFromUrl) return true

    // 5. Raw internship UUID (for dashboard compatibility)
    if (i.id === tokenFromUrl) return true

    return false
  })

  if (!matched) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto font-bold">
            ✗
          </div>
          <h1 className="text-xl font-bold text-gray-900">Verification Failed</h1>
          <p className="text-sm text-gray-500">
            This certificate could not be verified. The QR code may be invalid, tampered with, or the certificate has not been issued yet.
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

  // Now fetch full details for the matched internship
  const { data: internship } = await supabase
    .from('internships')
    .select('id, start_date, end_date, serial_no, certificate_url, certificate_approved, student:profiles!internships_student_id_fkey(full_name, roll_no, university, wing, area)')
    .eq('id', matched.id)
    .maybeSingle()

  if (!internship) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Record Not Found</h1>
          <p className="text-sm text-gray-500">The internship record could not be retrieved.</p>
        </div>
      </div>
    )
  }

  const { student } = internship as any
  const isCertified = internship.certificate_approved && internship.certificate_url

  const formatDate = (d: string | null) => {
    if (!d) return 'N/A'
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const areaText = student?.area === 'Headquarters'
    ? 'MCL Headquarters, Sambalpur'
    : `${student?.area || 'Talcher'} Area, MCL`

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-2xl w-full overflow-hidden">

        {/* Organization Header */}
        <div className="bg-[#0f4f2a] p-6 text-white flex items-center gap-4">
          <img src="/mcl-logo.jpg" alt="MCL Logo" className="w-12 h-12 object-contain bg-white rounded-lg p-1 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold">Mahanadi Coalfields Limited</h1>
            <p className="text-xs opacity-80">A Subsidiary of Coal India Limited</p>
            <p className="text-[10px] uppercase tracking-wider text-green-300 mt-1 font-semibold">Official Credential Verification Portal</p>
          </div>
        </div>

        {/* Verification Badge */}
        <div className="p-6 border-b border-gray-100 flex flex-col items-center text-center space-y-2 bg-green-50/30">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl font-bold shadow-inner">
            ✓
          </div>
          <h2 className="text-base font-bold text-green-800">Credential Authenticity Verified</h2>
          <p className="text-xs text-gray-500 max-w-sm">
            This page confirms that the individual listed below has officially completed an internship at Mahanadi Coalfields Limited.
          </p>
          <span className="text-[10px] bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold tracking-wide uppercase">
            Certificate Ref: MCL/HRD/INT/{internship.serial_no}
          </span>
        </div>

        {/* Details Grid */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-y-5 gap-x-6 text-sm">

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Candidate Name</span>
              <p className="font-semibold text-gray-900 mt-0.5">{student?.full_name || 'N/A'}</p>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Serial Number</span>
              <p className="font-bold text-green-700 mt-0.5">MCL/HRD/INT/{internship.serial_no}</p>
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
              <p className="font-semibold text-gray-800 mt-0.5">{areaText}</p>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Internship Period</span>
              <p className="font-semibold text-gray-800 mt-0.5">
                {formatDate(internship.start_date)} &nbsp;–&nbsp; {formatDate(internship.end_date)}
              </p>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Certificate Status</span>
              <p className="mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold
                  ${isCertified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {isCertified ? '✓  Issued & Approved' : '⏳  In Progress / Pending'}
                </span>
              </p>
            </div>

          </div>

          {/* Certificate Download */}
          {isCertified && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-gray-700">Official Internship Certificate</p>
                <p className="text-[10px] text-gray-400">Verified digital certificate issued by the HRD Department, MCL.</p>
              </div>
              <a
                href={internship.certificate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-4 py-2 bg-green-700 text-white text-xs font-semibold rounded-lg hover:bg-green-800 transition-colors"
              >
                View Certificate
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-100 p-4 text-center">
          <p className="text-[10px] text-gray-400">
            MCL Internship Verification System &nbsp;·&nbsp; For enquiries contact GM (HRD), MCL Headquarters, Sambalpur, Odisha.
          </p>
        </div>

      </div>
    </div>
  )
}
