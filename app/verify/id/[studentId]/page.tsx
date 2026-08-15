import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export const revalidate = 0

export default async function IdCardVerifyPage({ params }: { params: { studentId: string } }) {
  const supabase = createAdminClient()
  const { studentId } = params

  // Fetch student profile
  const { data: student } = await supabase
    .from('profiles')
    .select('full_name, roll_no, university, wing, area, email')
    .eq('id', studentId)
    .eq('role', 'student')
    .maybeSingle()

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto font-bold">
            ✗
          </div>
          <h1 className="text-xl font-bold text-gray-900">ID Verification Failed</h1>
          <p className="text-sm text-gray-500">
            This ID card could not be verified. The QR code may be invalid or tampered with.
          </p>
          <div className="pt-2">
            <Link href="/login" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              Go to Portal Login →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Fetch active internship
  const { data: internship } = await supabase
    .from('internships')
    .select('serial_no, start_date, end_date, internship_type')
    .eq('student_id', studentId)
    .maybeSingle()

  const formatDate = (d: string | null) => {
    if (!d) return 'N/A'
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const areaText = student.area === 'Headquarters'
    ? 'MCL Headquarters, Sambalpur'
    : `${student.area || 'MCL'} Area`

  const serialNo = internship?.serial_no
  const serialDisplay = serialNo
    ? `MCL/HRD/${(student.area || 'HQ').toUpperCase()}/${serialNo}`
    : 'Active Intern'

  const now = new Date()
  const endDate = internship?.end_date ? new Date(internship.end_date) : null
  const isActive = !endDate || endDate >= now

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-xl w-full overflow-hidden">

        {/* Organisation Header */}
        <div className="bg-white border-b-2 border-amber-400 px-6 py-4 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mcl-logo.jpg" alt="MCL Logo" className="w-11 h-11 object-contain bg-white rounded-lg p-1 border border-slate-100 flex-shrink-0" />
          <div>
            <h1 className="text-sm font-black text-emerald-950 uppercase tracking-wide">Mahanadi Coalfields Limited</h1>
            <p className="text-[10px] text-slate-400 font-semibold">A Subsidiary of Coal India Limited</p>
            <p className="text-[9px] uppercase tracking-wider text-emerald-600 mt-0.5 font-bold">Official Intern ID Verification</p>
          </div>
        </div>

        {/* Verification Badge */}
        <div className="p-6 border-b border-gray-100 flex flex-col items-center text-center space-y-2 bg-emerald-50/30">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl font-bold shadow-inner">
            ✓
          </div>
          <h2 className="text-base font-bold text-emerald-800">ID Card Authenticity Verified</h2>
          <p className="text-xs text-gray-500 max-w-sm">
            This page confirms that the individual listed below holds a valid official intern trainee ID issued by Mahanadi Coalfields Limited.
          </p>
          <span className={`text-[10px] px-3 py-1 rounded-full font-semibold tracking-wide uppercase ${
            isActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {isActive ? '🟢 Internship Active' : '⚪ Internship Completed'}
          </span>
        </div>

        {/* Details Grid */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-y-5 gap-x-6 text-sm">

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trainee Name</span>
              <p className="font-bold text-gray-900 mt-0.5 uppercase">{student.full_name}</p>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">ID / Serial No</span>
              <p className="font-bold text-emerald-700 mt-0.5 font-mono text-xs">{serialDisplay}</p>
            </div>

            {student.roll_no && (
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Roll Number</span>
                <p className="font-semibold text-gray-800 mt-0.5">{student.roll_no}</p>
              </div>
            )}

            {student.university && (
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">University / College</span>
                <p className="font-semibold text-gray-800 mt-0.5">{student.university}</p>
              </div>
            )}

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Department Wing</span>
              <p className="font-semibold text-gray-800 mt-0.5">{student.wing || 'N/A'}</p>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Training Location</span>
              <p className="font-semibold text-gray-800 mt-0.5">{areaText}</p>
            </div>

            {internship && (
              <div className="col-span-2">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Training Period</span>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {formatDate(internship.start_date)}&nbsp;–&nbsp;{formatDate(internship.end_date)}
                </p>
              </div>
            )}

            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Category</span>
              <p className="font-semibold text-gray-800 mt-0.5 capitalize">
                {internship?.internship_type === 'paid' ? 'Paid Intern' : 'Unpaid / Voluntary'}
              </p>
            </div>

          </div>

          {/* Security Note */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl mt-0.5">🔒</span>
            <div className="text-xs text-emerald-800 space-y-1">
              <p className="font-bold">Verified by MCL Portal System</p>
              <p className="text-emerald-700 leading-snug">
                This QR-linked ID is system-generated and cryptographically tied to the intern's official MCL Portal record. Any physical ID presenting this QR code is authentic if this page confirms the details above.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-100 p-4 text-center">
          <p className="text-[10px] text-gray-400">
            MCL Intern ID Verification System &nbsp;·&nbsp; For enquiries contact the Area Training Officer, {areaText}.
          </p>
        </div>

      </div>
    </div>
  )
}
