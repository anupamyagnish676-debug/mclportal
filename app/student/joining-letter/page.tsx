import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 print:bg-white print:py-0 print:px-0">
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
          <button
            onClick={() => window.print()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      {/* Official Letter Template */}
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 shadow-lg p-10 print:border-none print:shadow-none print:p-0 text-gray-900 text-sm font-serif leading-relaxed">
        
        {/* Letterhead Header */}
        <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-6 mb-6">
          <div className="flex items-center gap-4">
            {/* Styled Emblem */}
            <div className="w-16 h-16 bg-emerald-800 rounded-full flex items-center justify-center text-white font-extrabold text-lg flex-shrink-0">
              MCL
            </div>
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
            <h3 className="text-xs font-extrabold text-emerald-950 uppercase tracking-widest mb-4 text-center">
              प्रशिक्षण नियम एवं शर्तें / Training Terms &amp; Conditions
            </h3>
            
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
                <p className="font-bold text-gray-900">प्रशिक्षण उनके अपने जोखिम पर होगा, यदि उनकी प्रशिक्षण अवधि के दौरान कुछ होता है, तो कंपनी जिम्मेदार नहीं होगी। छात्रा को इस आशय का एक वचन पत्र प्रस्तुत करना होगा।</p>
                <p className="text-gray-500 mt-0.5">The training will be at their own risk, if anything happens during their training period, the company will not be responsible. The student must submit an undertaking to this effect.</p>
              </li>
              <li>
                <p className="font-bold text-gray-900">एमसीएल द्वारा कोई वित्तीय भार वहन नहीं किया जाएगा।</p>
                <p className="text-gray-500 mt-0.5">No financial burden will be borne by MCL.</p>
              </li>
              <li>
                <p className="font-bold text-gray-900">संबंधित क्षेत्र/परियोजना/विभाग द्वारा लगाई गई कोई अन्य शर्तें।</p>
                <p className="text-gray-500 mt-0.5">Any other conditions imposed by the concerned sector/project/department.</p>
              </li>
              <li>
                <p className="font-bold text-gray-900">छात्र को सलाह दी जाती है कि वह इस ईमेल का प्रिंटआउट लें और रिपोर्ट करें।</p>
                <p className="text-gray-500 mt-0.5">The Student is advised to take a printout of this mail and report.</p>
              </li>
            </ol>
          </div>

          {/* Reporting advice message */}
          <div className="bg-emerald-50 border border-emerald-200/50 rounded-xl p-4 my-6 text-xs font-sans text-emerald-950 space-y-1.5 print:bg-white print:border-gray-300">
            <p className="font-bold text-[11px] uppercase tracking-wider text-emerald-900">🚨 Reporting Advisory / रिपोर्टिंग निर्देश:</p>
            <p className="font-bold text-gray-900"> आपसे अनुरोध है कि उपरोक्त छात्रा को आगे की आवश्यक कार्रवाई के लिए अपने पहचान पत्र के साथ General Manager, {areaName} Area, MCL को उपरोक्त तिथि के अनुसार रिपोर्ट करने की सलाह दें। </p>
            <p className="text-emerald-800 mt-1"> You are requested to advise the above students to report to the General Manager, {areaName} Area, MCL as per the above date along with his identity card for further necessary action. </p>
          </div>
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-end pt-12 mt-12 border-t border-gray-100 font-sans text-xs">
          <div>
            <p className="font-bold text-gray-400 uppercase tracking-widest">Office Seal</p>
            <div className="w-24 h-24 border border-dashed border-gray-300 rounded-lg mt-2 flex items-center justify-center text-gray-300 text-[10px]">
              MCL Area Stamp
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="h-10"></div> {/* Space for signature */}
            <p className="font-bold text-emerald-950">Area Training Officer / General Manager (HRD)</p>
            <p className="text-gray-500">Mahanadi Coalfields Limited, {areaName} Area</p>
          </div>
        </div>

      </div>
    </div>
  )
}
