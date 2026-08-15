import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PrintButton from './PrintButton'

export const revalidate = 0

export default async function JoiningLetterPage() {
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
    .select('*, mentor:profiles!internships_mentor_id_fkey(full_name, email)')
    .eq('student_id', user.id)
    .maybeSingle()

  const serialNo = internship?.serial_no || 'N/A'
  const startDate = internship?.start_date ? new Date(internship.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'
  const endDate = internship?.end_date ? new Date(internship.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'
  const areaName = student.area || 'Concerned'

  // Fetch signatures using createAdminClient to bypass RLS restrictions for student view
  const adminClient = createAdminClient()

  // Fetch HQ Admin (GM HRD) signature
  const { data: hqAdmin } = await adminClient
    .from('profiles')
    .select('full_name, signature_data')
    .eq('email', 'anupamyagnish87@gmail.com')
    .maybeSingle()

  // Fetch Area Admin (Area Training Officer) signature
  const { data: areaAdmins } = await adminClient
    .from('profiles')
    .select('full_name, signature_data')
    .eq('role', 'admin')
    .eq('area', areaName)
    .not('signature_data', 'is', null)
    .limit(1)

  const areaAdmin = areaAdmins?.[0] || null

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 print:bg-white print:py-0 print:px-0">
      
      {/* Global CSS Overrides for Perfect Print Layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4;
          margin: 0 !important;
        }
        @media print {
          /* Reset parent layout and main content container spacing/offsets */
          html, body, main, .flex {
            margin: 0 !important;
            padding: 0 !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            box-shadow: none !important;
            background: white !important;
          }
          /* Hide all outer components, sidebars, headers, and dashboard wrapping UI */
          body * {
            visibility: hidden !important;
          }
          /* Selectively make only the letterhead card container and its contents visible */
          .print-letter-container,
          .print-letter-container * {
            visibility: visible !important;
          }
          /* Reposition the printable container to match A4 print margins perfectly */
          .print-letter-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 20mm 20mm 20mm 20mm !important; /* Elegant 20mm margins for official printout */
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }
          /* Enforce printing of images and graphic backgrounds */
          img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            display: inline-block !important;
          }
        }
      `}} />

      {/* Action Header Banner (Hidden during Print) */}
      <div className="max-w-4xl mx-auto mb-6 bg-white border border-gray-200 p-4 rounded-2xl flex items-center justify-between shadow-sm print:hidden">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-gray-800">Printable Joining &amp; Reporting Letter</h2>
          <p className="text-xs text-gray-500">Download, print or save this letter for reporting to the training office.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/student"
            className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
          >
            ← Dashboard
          </Link>
          <PrintButton />
          <a
            href="/api/student/joining-letter"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            📥 Download PDF
          </a>
        </div>
      </div>

      {/* Official Letter Template (Annotated with print-letter-container) */}
      <div className="print-letter-container max-w-4xl mx-auto bg-white border border-gray-200 shadow-lg p-10 print:border-none print:shadow-none print:p-0 text-gray-900 text-sm font-serif leading-relaxed">
        
        {/* Letterhead Header */}
        <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-6 mb-6">
          <div className="flex items-center gap-4">
            {/* Official Transparent MCL Logo from local public directory */}
            <img 
              src="/mcl-logo-transparent.png" 
              alt="MCL Logo" 
              className="w-16 h-16 object-contain flex-shrink-0"
            />
            <div>
              <h1 className="text-xl font-black text-emerald-900 uppercase tracking-wide leading-none">Mahanadi Coalfields Limited</h1>
              <p className="text-xs font-sans text-gray-600 mt-1.5 font-bold uppercase tracking-wider">(A Subsidiary of Coal India Limited)</p>
              <p className="text-xs font-sans text-gray-500 mt-0.5">Office of the General Manager, {areaName} Area, MCL</p>
            </div>
          </div>
          <div className="text-right text-xs font-sans text-gray-500 space-y-1">
            <p className="font-bold text-emerald-950">MCL INTERNAL TRAINING PORTAL</p>
            <p>Ref: MCL/{areaName.toUpperCase()}/INT/{new Date().getFullYear()}/{serialNo}</p>
            <p>Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-6">
          <h2 className="text-base font-bold underline uppercase tracking-wider text-emerald-950">
            OFFICIAL INTERNSHIP JOINING &amp; ALLOCATION ORDER
          </h2>
        </div>

        {/* Letter Body */}
        <div className="space-y-4 font-serif">
          <p>To,</p>
          <div className="pl-6 font-bold text-gray-800">
            <p>{student.full_name}</p>
            <p>University: {student.university || 'N/A'}</p>
            <p>Roll / Reg No: {student.roll_no || 'N/A'}</p>
          </div>

          <p className="indent-8 text-justify mt-4">
            With reference to the Letter of Recommendation submitted on your behalf, we are pleased to confirm that you have been approved and allocated to undergo internship training at <strong>Mahanadi Coalfields Limited (MCL)</strong>. Your training profile details are outlined below:
          </p>

          {/* Allocation details table */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 my-6 print:bg-white print:border-gray-300 font-sans">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-slate-100 print:border-gray-200"><td className="py-2 font-bold text-emerald-900 w-1/3">Internship Serial Number</td><td className="py-2 font-semibold text-gray-800">MCL/HRD/{areaName.toUpperCase()}/{serialNo}</td></tr>
                <tr className="border-b border-slate-100 print:border-gray-200"><td className="py-2 font-bold text-emerald-900">Training Allocated Area</td><td className="py-2 font-semibold text-gray-800">{areaName} Area Office, MCL</td></tr>
                <tr className="border-b border-slate-100 print:border-gray-200"><td className="py-2 font-bold text-emerald-900">Allocated Department</td><td className="py-2 font-semibold text-gray-800">{student.wing || 'Technical Wing'}</td></tr>
                <tr className="border-b border-slate-100 print:border-gray-200"><td className="py-2 font-bold text-emerald-900">Training Period Range</td><td className="py-2 font-semibold text-gray-800">{startDate} to {endDate}</td></tr>
                <tr><td className="py-2 font-bold text-emerald-900">Stipend Designation</td><td className="py-2 font-semibold text-gray-800">{internship?.internship_type === 'paid' ? 'Paid Internship' : 'Unpaid Training'}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="border-t border-b border-gray-200 py-6 my-6 font-sans">
            <div className="text-xs font-bold text-emerald-950 mb-4 text-center space-y-1">
              <p>निम्नलिखित नियम एवं शर्तों के आधार पर छात्र को निःशुल्क प्रशिक्षण दिया जा रहा है:-</p>
              <p className="text-gray-500 font-semibold">Training is being given to the student on the basis of the following terms and conditions:-</p>
            </div>
            
            <ol className="list-decimal pl-6 space-y-4 text-xs text-justify text-gray-800">
              <li>
                <p className="font-bold text-gray-900">छात्र द्वारा एकत्रित की गई जानकारी का उपयोग केवल शैक्षणिक उद्देश्य के लिए किया जाएगा।</p>
                <p className="text-gray-500 mt-0.5">The information collected by the student will be used only for educational purpose.</p>
              </li>
              <li>
                <p className="font-bold text-gray-900">प्रशिक्षण अवधि के दौरान छात्र को हुई किसी भी चोट/दुर्घटना के लिए कंपनी जिम्मेदार नहीं होगी।</p>
                <p className="text-gray-500 mt-0.5">The Company will not be responsible for any injury/accident caused to the student during the training period.</p>
              </li>
              <li>
                <p className="font-bold text-gray-900">कंपनी द्वारा छात्र को कोई आवास और परिवहन प्रदान नहीं किया जाएगा।</p>
                <p className="text-gray-500 mt-0.5">No accommodation and transportation will be provided to the student by the company.</p>
              </li>
              <li>
                <p className="font-bold text-gray-900">प्रशिक्षण उनके अपने जोखिम पर होगा। यदि प्रशिक्षण के दौरान कुछ होता है, तो कंपनी जिम्मेदार नहीं होगी। छात्र को इस आशय का एक वचन पत्र प्रस्तुत करना होगा।</p>
                <p className="text-gray-500 mt-0.5">The training will be at their own risk, if anything happens during their training period, the company will not be responsible. The student will have to submit an undertaking to this effect.</p>
              </li>
              <li>
                <p className="font-bold text-gray-900">एमसीएल द्वारा कोई वित्तीय भार वहन नहीं किया जाएगा।</p>
                <p className="text-gray-500 mt-0.5">No financial burden will be borne by MCL.</p>
              </li>
              <li>
                <p className="font-bold text-gray-900">संबंधित क्षेत्र/परियोजना/विभाग द्वारा लगाई गई कोई अन्य शर्तें।</p>
                <p className="text-gray-500 mt-0.5">Any other conditions imposed by the concerned sector/project/department.</p>
              </li>
            </ol>
          </div>

          {/* Reporting advisory (no background color, styled elegantly with clean horizontal borders) */}
          <div className="border-t border-b border-gray-200 py-4 my-6 text-xs font-sans text-gray-900 space-y-1.5 print:border-gray-300">
            <p className="font-bold text-[11px] uppercase tracking-wider text-emerald-900">🚨 Reporting Advisory / रिपोर्टिंग निर्देश:</p>
            <p className="font-bold text-gray-900"> आपसे अनुरोध है कि उपरोक्त छात्र को आगे की आवश्यक कार्रवाई के लिए अपने पहचान पत्र के साथ उपरोक्त तिथि के अनुसार General Manager, {areaName} Area, MCL को रिपोर्ट करने की सलाह दें। </p>
            <p className="text-gray-700 mt-1"> You are requested to advise the above students to report to the General Manager, {areaName} Area, MCL HQ as per the above date along with his identity card for further necessary action. </p>
          </div>
        </div>

        {/* Dynamic Signatures Section with Swapped Positions */}
        <div className="flex justify-between items-end pt-12 mt-12 border-t border-gray-200 font-sans text-xs">
          
          {/* Left: Area Training Officer Signature from DB */}
          <div className="text-left space-y-1.5 w-1/2">
            <div className="h-16 flex items-end">
              {areaAdmin?.signature_data ? (
                <img 
                  src={areaAdmin.signature_data} 
                  alt="Area Training Officer Signature" 
                  className="h-14 object-contain inline-block"
                />
              ) : (
                <div className="h-14 border border-dashed border-gray-200 rounded flex items-center justify-center text-gray-300 w-28 text-[9px]">
                  Pending Signature
                </div>
              )}
            </div>
            <p className="font-bold text-emerald-950">Area Training Officer</p>
            <p className="text-gray-500 font-bold">Mahanadi Coalfields Limited, {areaName} Area</p>
          </div>

          {/* Right: General Manager (HRD) Signature (loaded from official gm-signature.png) */}
          <div className="text-right space-y-1.5 w-1/2">
            <div className="h-16 flex items-end justify-end">
              <img 
                src="/gm-signature.png" 
                alt="General Manager (HRD) Signature" 
                className="h-14 object-contain inline-block ml-auto"
              />
            </div>
            <p className="font-bold text-emerald-950">General Manager (HRD)</p>
            <p className="text-gray-500 font-bold">Mahanadi Coalfields Limited</p>
          </div>
        </div>

      </div>
    </div>
  )
}
