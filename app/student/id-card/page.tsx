import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const revalidate = 0

export default async function StudentIdCardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!student || student.role !== 'student') {
    redirect('/login')
  }

  const { data: internship } = await supabase
    .from('internships')
    .select('*')
    .eq('student_id', user.id)
    .maybeSingle()

  const areaName = student.area || 'Headquarters'
  const serialNo = internship?.serial_no || 'N/A'

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-xl text-center space-y-6">

        {/* Top Icon */}
        <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
          🪪
        </div>

        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Official Intern Trainee ID Card</h1>
          <p className="text-xs text-slate-500 mt-1">
            Mahanadi Coalfields Limited — Standard ISO CR80 ID Card
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Trainee Name</span>
            <span className="font-bold text-slate-900 uppercase">{student.full_name}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200/60 pt-2">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Serial Number</span>
            <span className="font-mono font-bold text-emerald-800 text-[11px]">MCL/HRD/{areaName.toUpperCase()}/{serialNo}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200/60 pt-2">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Allocated Area</span>
            <span className="font-bold text-slate-800">{areaName} Area Office</span>
          </div>
          <div className="flex justify-between border-t border-slate-200/60 pt-2">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">PDF Dimensions</span>
            <span className="font-semibold text-slate-600">85.60 mm × 53.98 mm (Standard ID Card)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <a
            href="/api/student/generate-id-card"
            download={`${student.full_name.replace(/[^a-zA-Z0-9]/g, '_')}_MCL_ID_Card.pdf`}
            className="w-full py-3.5 px-6 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 group"
          >
            <span>📥 Download Official ID Card (PDF)</span>
          </a>

          <Link
            href="/student"
            className="block text-xs font-semibold text-slate-500 hover:text-slate-800 py-1 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Security Note */}
        <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 text-[11px] text-amber-900 text-left flex items-start gap-2">
          <span className="text-sm mt-0.5">ℹ️</span>
          <div>
            <p className="font-bold text-[10px] uppercase">Standard ISO CR80 PDF</p>
            <p className="text-[10px] text-amber-800 leading-normal">
              The downloaded PDF contains your embedded photo, Area Admin digital signature, and verification QR code ready for high-resolution plastic/paper ID card printing.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
