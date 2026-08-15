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

  // Fetch student's passport photo from student_documents table
  const adminClient = createAdminClient()
  const { data: photoDoc } = await adminClient
    .from('student_documents')
    .select('file_url, status')
    .eq('student_id', user.id)
    .eq('doc_type', 'photo')
    .maybeSingle()

  const passportPhotoUrl = photoDoc?.file_url || null

  const startDate = internship?.start_date 
    ? new Date(internship.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
    : 'N/A'
  const endDate = internship?.end_date 
    ? new Date(internship.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
    : 'N/A'

  // Generate Verification QR Code
  const qrDataText = `MCL INTERN ID\nName: ${student.full_name}\nSerial: MCL/HRD/${areaName.toUpperCase()}/${serialNo}\nArea: ${areaName}\nValid: ${startDate} - ${endDate}`
  let qrCodeDataUrl = ''
  try {
    qrCodeDataUrl = await QRCode.toDataURL(qrDataText, { margin: 1, width: 90 })
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
        
        {/* Header Section */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white p-5 text-center relative border-b-4 border-amber-400">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img 
              src="/mcl-logo-transparent.png" 
              alt="MCL Logo" 
              className="w-10 h-10 object-contain"
            />
            <div className="text-left">
              <h2 className="text-xs font-black uppercase tracking-wider text-emerald-100 leading-tight">Mahanadi Coalfields Limited</h2>
              <p className="text-[9px] text-emerald-300 font-semibold uppercase tracking-wider">(A Subsidiary of Coal India Limited)</p>
            </div>
          </div>
          
          <div className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-extrabold uppercase tracking-widest py-0.5 px-3 rounded-full inline-block mt-1">
            Official Intern Trainee ID Card
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 bg-slate-50/50 space-y-4">
          
          {/* Photo & Basic Details Row */}
          <div className="flex gap-4 items-center">
            
            {/* Passport Photo Box */}
            <div className="w-28 h-36 flex-shrink-0 bg-white border-2 border-emerald-800 rounded-xl overflow-hidden shadow-md relative flex items-center justify-center p-0.5">
              {passportPhotoUrl ? (
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

              <div className="absolute bottom-1 right-1 bg-emerald-600 text-white text-[7px] font-bold px-1 rounded uppercase">
                VERIFIED
              </div>
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
                <span className="inline-block bg-emerald-100 text-emerald-900 font-bold text-[10px] px-2 py-0.5 rounded-md border border-emerald-200">
                  {areaName} Area Office
                </span>
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
          <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-300">
            
            {/* QR Code */}
            <div className="flex items-center gap-2">
              {qrCodeDataUrl && (
                <img 
                  src={qrCodeDataUrl} 
                  alt="Verification QR Code" 
                  className="w-14 h-14 object-contain border border-slate-200 rounded-lg p-0.5 bg-white shadow-xs"
                />
              )}
              <div className="text-[8px] text-slate-500 leading-tight">
                <p className="font-bold text-slate-700">Digital Gate Pass</p>
                <p>Scan to verify authenticity</p>
              </div>
            </div>

            {/* Authorized Signature */}
            <div className="text-right space-y-0.5">
              <img 
                src="/gm-signature.png" 
                alt="GM HRD Signature" 
                className="h-8 object-contain ml-auto mix-blend-multiply"
              />
              <div className="w-24 border-b border-slate-400 ml-auto"></div>
              <p className="text-[8px] font-bold text-emerald-950">General Manager (HRD)</p>
              <p className="text-[7px] text-slate-400">Issuing Authority</p>
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
