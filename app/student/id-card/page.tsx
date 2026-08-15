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

  const { data: student } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!student || student.role !== 'student') redirect('/login')

  const { data: internship } = await supabase
    .from('internships')
    .select('*')
    .eq('student_id', user.id)
    .maybeSingle()

  const areaName = student.area || 'Concerned'
  const serialNo = internship?.serial_no || 'N/A'

  const adminClient = createAdminClient()

  // Fetch student passport photo
  const { data: photoDoc } = await adminClient
    .from('student_documents')
    .select('file_url, file_path, status')
    .eq('student_id', user.id)
    .eq('doc_type', 'photo')
    .maybeSingle()

  const passportPhotoUrl = photoDoc
    ? `/api/student/photo-proxy?studentId=${user.id}&t=${Date.now()}`
    : null

  // Fetch area admin signature — try by area match, fallback to any area admin
  let areaAdmin: { full_name: string; signature_data: string | null } | null = null

  if (areaName && areaName !== 'Concerned') {
    // Primary: find admin whose area exactly matches
    const { data: exactMatch } = await adminClient
      .from('profiles')
      .select('full_name, signature_data')
      .eq('role', 'admin')
      .ilike('area', areaName.trim())
      .not('signature_data', 'is', null)
      .maybeSingle()

    if (exactMatch) {
      areaAdmin = exactMatch
    } else {
      // Secondary: find any admin in this area (even without signature)
      const { data: anyAdmin } = await adminClient
        .from('profiles')
        .select('full_name, signature_data')
        .eq('role', 'admin')
        .ilike('area', areaName.trim())
        .maybeSingle()
      areaAdmin = anyAdmin
    }
  }

  const areaAdminName = areaAdmin?.full_name || 'Area Training Officer'
  const areaAdminSignature = areaAdmin?.signature_data || null

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'

  const startDate = fmtDate(internship?.start_date ?? null)
  const endDate = fmtDate(internship?.end_date ?? null)

  // QR points to live verification page
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mclportal.vercel.app'
  const verifyUrl = `${baseUrl}/verify/id/${user.id}`
  let qrCodeDataUrl = ''
  try {
    qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 110,
      errorCorrectionLevel: 'M',
      color: { dark: '#134e2a', light: '#ffffff' },
    })
  } catch (err) {
    console.error('QR Code generation failed:', err)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 py-10 px-4 print:bg-white print:py-0 print:px-0">

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Roboto+Mono:wght@600&display=swap');
        @page { size: A4 portrait; margin: 0 !important; }
        @media print {
          html, body, main, .flex { margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          .print-id-card-wrapper, .print-id-card-wrapper * { visibility: visible !important; }
          .print-id-card-wrapper {
            position: absolute !important; left: 50% !important; top: 40px !important;
            transform: translateX(-50%) !important; margin: 0 !important;
            box-shadow: none !important; border: 1px solid #cbd5e1 !important;
          }
        }
      `}} />

      {/* Top nav (hidden on print) */}
      <div className="max-w-sm mx-auto mb-5 flex items-center justify-between print:hidden">
        <Link href="/student" className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1">
          ← Back to Dashboard
        </Link>
        <PrintIdCardButton />
      </div>

      {/* ── ID CARD ── */}
      <div className="print-id-card-wrapper max-w-sm mx-auto rounded-2xl overflow-hidden shadow-2xl border border-slate-300"
           style={{ fontFamily: "'Inter', sans-serif", background: '#fff' }}>

        {/* ── TOP HEADER ── */}
        <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '3px solid #f59e0b' }}>
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }} />

          <div className="relative flex items-center gap-3 px-5 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mcl-logo-transparent.png" alt="MCL" className="w-10 h-10 object-contain flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-800 leading-tight">
                Mahanadi Coalfields Limited
              </p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-400 leading-tight mt-0.5">
                A Subsidiary of Coal India Limited
              </p>
            </div>
            <div className="flex-shrink-0 text-[7.5px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 px-2 py-0.5 rounded">
              INTERN ID
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="px-5 py-4 space-y-4">

          {/* Photo + Name row */}
          <div className="flex gap-4 items-start">

            {/* Photo */}
            <div className="flex-shrink-0 w-[90px] h-[110px] rounded-lg overflow-hidden border-2 border-slate-300 shadow-md bg-slate-100 relative">
              {passportPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={passportPhotoUrl} alt="Passport Photo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2">
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-[8px] font-bold text-slate-400 leading-tight">No Photo</span>
                </div>
              )}
              {/* Decorative corner badge */}
              <div className="absolute top-1 left-1 w-2.5 h-2.5 rounded-sm bg-amber-400 opacity-90" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2.5 pt-0.5">
              {/* Name */}
              <div>
                <p className="text-[7.5px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Trainee Name</p>
                <p className="text-sm font-black text-slate-900 uppercase leading-tight tracking-wide">
                  {student.full_name}
                </p>
              </div>

              {/* Serial */}
              <div>
                <p className="text-[7.5px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Serial No.</p>
                <p className="text-[10px] font-bold text-slate-700 leading-tight" style={{ fontFamily: "'Roboto Mono', monospace" }}>
                  MCL/HRD/{areaName.toUpperCase()}/{serialNo}
                </p>
              </div>

              {/* Area */}
              <div>
                <p className="text-[7.5px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Area</p>
                <p className="text-[10px] font-bold text-emerald-800 leading-tight">
                  {areaName} Area Office
                </p>
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-dashed border-slate-200" />

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {[
              { label: 'Institution', value: student.university || 'N/A' },
              { label: 'Roll / Reg No', value: student.roll_no || 'N/A' },
              { label: 'Department Wing', value: student.wing || 'Technical Wing' },
              { label: 'Stipend', value: internship?.internship_type === 'paid' ? 'Paid Category' : 'Unpaid Category' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[7.5px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">{label}</p>
                <p className="text-[10px] font-semibold text-slate-800 leading-tight truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Training period — full row */}
          <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 flex items-center justify-between">
            <p className="text-[7.5px] font-bold uppercase tracking-widest text-slate-400">Training Period</p>
            <p className="text-[10px] font-bold text-emerald-900">{startDate} — {endDate}</p>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-dashed border-slate-200" />

          {/* QR + Signature row */}
          <div className="flex items-end justify-between gap-2">

            {/* QR Code */}
            <div className="flex items-center gap-2">
              {qrCodeDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCodeDataUrl}
                  alt="Scan to verify"
                  className="w-[60px] h-[60px] object-contain rounded border border-slate-200 bg-white"
                />
              )}
              <div>
                <p className="text-[8px] font-black text-slate-700 leading-tight">Digital Gate Pass</p>
                <p className="text-[7px] text-slate-400 leading-tight">Scan to verify</p>
              </div>
            </div>

            {/* Signature block */}
            <div className="text-right flex-shrink-0 max-w-[130px]">
              <div className="h-10 flex items-end justify-end mb-0.5">
                {areaAdminSignature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={areaAdminSignature}
                    alt="Area Admin Signature"
                    className="max-h-10 max-w-[120px] object-contain mix-blend-multiply"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/gm-signature.png"
                    alt="Authorised Signature"
                    className="max-h-10 max-w-[120px] object-contain mix-blend-multiply"
                  />
                )}
              </div>
              <div className="w-full border-b border-slate-400 mb-0.5" />
              <p className="text-[7.5px] font-black text-slate-800 leading-tight truncate">{areaAdminName}</p>
              <p className="text-[6.5px] text-slate-400 leading-tight">Area Training Officer, MCL</p>
            </div>

          </div>
        </div>

        {/* ── Footer strip ── */}
        <div className="flex items-center justify-between px-5 py-1.5 bg-slate-900">
          <p className="text-[7px] font-mono text-slate-500 uppercase tracking-widest">
            MCL · Official Trainee ID
          </p>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400 opacity-80" />
            <div className="w-2 h-2 rounded-full bg-emerald-500 opacity-80" />
          </div>
        </div>
      </div>

      {/* Helper note (hidden on print) */}
      <p className="text-center text-xs text-slate-400 mt-4 print:hidden">
        Area admin must save their digital signature in <strong>Admin → Settings</strong> for it to appear here.
      </p>
    </div>
  )
}
