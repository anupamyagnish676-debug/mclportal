import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import PrintIdCardButton from './PrintIdCardButton'

export const revalidate = 0

export default async function StudentIdCardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch student profile
  const { data: student } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!student || student.role !== 'student') {
    redirect('/login')
  }

  // Fetch active internship
  const { data: internship } = await supabase
    .from('internships')
    .select('*')
    .eq('student_id', user.id)
    .maybeSingle()

  const areaName = student.area || 'Concerned'
  const serialNo = internship?.serial_no || 'N/A'

  const adminClient = createAdminClient()

  // Fetch student's passport photo from student_documents table
  const { data: photoDoc } = await adminClient
    .from('student_documents')
    .select('file_url, file_path, status')
    .eq('student_id', user.id)
    .eq('doc_type', 'photo')
    .maybeSingle()

  // Always use the server-side photo proxy so Google Drive images load correctly
  const passportPhotoUrl = photoDoc ? `/api/student/photo-proxy?studentId=${user.id}&t=${Date.now()}` : null

  // Fetch Area Admin's signature_data
  // Step 1: find admin in this area who has a signature saved
  let areaAdmin: { full_name: string; signature_data: string | null } | null = null

  if (areaName && areaName !== 'Concerned') {
    // Use .limit(1) NOT .maybeSingle() — multiple admins per area exist and maybeSingle() returns null on >1 rows
    const { data: withSigRows } = await adminClient
      .from('profiles')
      .select('full_name, signature_data')
      .eq('role', 'admin')
      .ilike('area', areaName.trim())
      .not('signature_data', 'is', null)
      .limit(1)

    if (withSigRows && withSigRows.length > 0) {
      areaAdmin = withSigRows[0]
    } else {
      // Step 2: any admin in this area even without signature
      const { data: anyRows } = await adminClient
        .from('profiles')
        .select('full_name, signature_data')
        .eq('role', 'admin')
        .ilike('area', areaName.trim())
        .limit(1)
      areaAdmin = anyRows && anyRows.length > 0 ? anyRows[0] : null
    }
  }

  const areaAdminName = areaAdmin?.full_name || 'Area Training Officer'
  const areaAdminSignature = areaAdmin?.signature_data || null

  const startDate = internship?.start_date
    ? new Date(internship.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A'
  const endDate = internship?.end_date
    ? new Date(internship.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A'

  // Generate Verification QR Code pointing to a live verification page
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mclportal.vercel.app'
  const verifyUrl = `${baseUrl}/verify/id/${user.id}`
  let qrCodeDataUrl = ''
  try {
    qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 100, errorCorrectionLevel: 'M' })
  } catch (err) {
    console.error('QR Code generation failed:', err)
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 print:bg-white print:py-0 print:px-0">

      {/* Print Stylesheet for ID Card */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        @media print {
          html, body, main, .flex {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
          }
          body * {
            visibility: hidden !important;
          }
          .print-id-card-wrapper,
          .print-id-card-wrapper * {
            visibility: visible !important;
          }
          .print-id-card-wrapper {
            position: absolute !important;
            left: 50% !important;
            top: 40px !important;
            transform: translateX(-50%) !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
          }
        }
      `}} />

      {/* Top Banner (Hidden in Print) */}
      <div className="max-w-xl mx-auto mb-6 bg-white border border-gray-200 p-4 rounded-2xl flex items-center justify-between shadow-sm print:hidden">
        <div>
          <h1 className="text-base font-bold text-gray-900">Official Student ID Card</h1>
          <p className="text-xs text-gray-500">Digital verification badge &amp; Gate Entry Pass</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/student"
            className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            ← Dashboard
          </Link>
          <PrintIdCardButton />
        </div>
      </div>

      {/* Printable ID Card Container */}
      <div className="print-id-card-wrapper max-w-sm mx-auto bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden font-sans">

        {/* ── Compact Header Strip ── */}
        <div className="bg-white border-b-2 border-amber-400 px-5 py-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mcl-logo-transparent.png"
            alt="MCL Logo"
            className="w-9 h-9 object-contain flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-950 leading-tight">
              Mahanadi Coalfields Limited
            </p>
            <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider leading-tight">
              A Subsidiary of Coal India Limited
            </p>
          </div>
          <div className="flex-shrink-0 bg-amber-400 text-[7px] font-extrabold uppercase tracking-widest py-0.5 px-2 rounded-full text-amber-950">
            INTERN ID
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 bg-slate-50/40 space-y-4">

          {/* Photo & Basic Details Row */}
          <div className="flex gap-4 items-center">

            {/* Passport Photo Box */}
            <div className="w-28 h-36 flex-shrink-0 bg-white border-2 border-emerald-800 rounded-xl overflow-hidden shadow-md relative flex items-center justify-center p-0.5">
              {passportPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={passportPhotoUrl}
                  alt="Student Passport Photo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-center p-2">
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-[9px] font-bold text-slate-500 leading-tight">No Photo Uploaded</span>
                  <span className="text-[8px] text-emerald-700 font-semibold mt-1">Upload in Docs</span>
                </div>
              )}
            </div>

            {/* Main Info */}
            <div className="flex-1 space-y-1.5 text-xs">
              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Trainee Name</p>
                <p className="font-extrabold text-emerald-950 text-sm leading-tight uppercase">{student.full_name}</p>
              </div>

              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Serial Number</p>
                <p className="font-mono font-bold text-xs text-slate-800">MCL/HRD/{areaName.toUpperCase()}/{serialNo}</p>
              </div>

              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Allocated Area</p>
                <p className="font-bold text-emerald-900 text-[10px]">
                  {areaName} Area Office
                </p>
              </div>
            </div>

          </div>

          {/* Secondary Details Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 text-[11px] grid grid-cols-2 gap-2 shadow-sm">
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Institution</p>
              <p className="font-bold text-slate-800 truncate">{student.university || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Roll / Reg No</p>
              <p className="font-bold text-slate-800">{student.roll_no || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Department Wing</p>
              <p className="font-semibold text-slate-700">{student.wing || 'Technical Wing'}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Stipend Status</p>
              <p className="font-semibold text-slate-700 capitalize">{internship?.internship_type === 'paid' ? 'Paid Category' : 'Unpaid Category'}</p>
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-1.5 flex justify-between items-center text-[10px]">
              <span className="text-slate-400 font-bold uppercase">Training Period:</span>
              <span className="font-bold text-emerald-900">{startDate} — {endDate}</span>
            </div>
          </div>

          {/* Verification QR & Signature Footer */}
          <div className="flex items-end justify-between pt-2 border-t border-dashed border-slate-300">

            {/* QR Code — links to live verification page */}
            <div className="flex items-center gap-2">
              {qrCodeDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCodeDataUrl}
                  alt="Verification QR Code"
                  className="w-16 h-16 object-contain border border-slate-200 rounded-lg p-0.5 bg-white shadow-xs"
                />
              )}
              <div className="text-[8px] text-slate-500 leading-tight">
                <p className="font-bold text-slate-700">Digital Gate Pass</p>
                <p>Scan to verify</p>
                <p className="text-emerald-600 font-semibold">authenticity</p>
              </div>
            </div>

            {/* Area Admin Signature */}
            <div className="text-right space-y-0.5">
              {areaAdminSignature ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={areaAdminSignature}
                  alt="Area Admin Signature"
                  className="h-8 object-contain ml-auto mix-blend-multiply"
                />
              ) : (
                // Fallback: GM HRD signature image
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/gm-signature.png"
                  alt="Authorised Signature"
                  className="h-8 object-contain ml-auto mix-blend-multiply"
                />
              )}
              <div className="w-24 border-b border-slate-400 ml-auto"></div>
              <p className="text-[8px] font-bold text-emerald-950">{areaAdminName}</p>
              <p className="text-[7px] text-slate-400">Area Training Officer, MCL</p>
            </div>

          </div>

        </div>

        {/* Security Disclaimer Strip */}
        <div className="bg-slate-900 text-slate-400 text-[8px] py-1.5 px-4 text-center font-mono">
          System Generated Official Trainee ID • Property of MCL HRD
        </div>

      </div>
    </div>
  )
}
