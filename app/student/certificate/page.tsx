import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export default async function StudentCertificatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: internship } = await supabase
    .from('internships')
    .select('*, mentor:profiles!internships_mentor_id_fkey(full_name)')
    .eq('student_id', user!.id)
    .maybeSingle()

  const host = headers().get('host') || 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const verifyUrl = internship ? `${protocol}://${host}/verify/${internship.id}` : ''
  const qrCodeUrl = verifyUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}` : ''

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Certificate</h1>
      <p className="text-gray-500 text-sm mb-6">Your internship completion certificate</p>

      <div className="bg-white rounded-xl border border-gray-100 p-8 max-w-lg">
        {internship?.certificate_url ? (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🎓</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Certificate ready!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Your internship at MCL has been successfully completed. Download your certificate below.
            </p>
            <a href={internship.certificate_url} target="_blank" rel="noopener noreferrer"
              className="inline-block bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors mb-6">
              Download Certificate →
            </a>

            <div className="pt-6 border-t border-gray-100 flex flex-col items-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Scan to Verify Credential</p>
              <div className="bg-white p-2 border border-gray-100 rounded-xl shadow-sm">
                <img src={qrCodeUrl} alt="Verification QR Code" className="w-32 h-32" />
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Verify URL: {verifyUrl}</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">⏳</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Not yet issued</h2>
            <p className="text-gray-500 text-sm">
              Your certificate will be available here once you have completed the required attendance
              and submitted all assignments. Your mentor will notify the admin to issue it.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
