import { createClient } from '@/lib/supabase/server'
import ProjectReportUpload from './ProjectReportUpload'
import { Calendar, ClipboardList, CheckCircle2 } from 'lucide-react'

export const revalidate = 0

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: internship, error } = await supabase
    .from('internships')
    .select('*, mentor:profiles!internships_mentor_id_fkey(full_name, email)')
    .eq('student_id', user!.id)
    .maybeSingle()

  let presentDays = 0, totalAssignments = 0, submitted = 0
  if (internship) {
    const [p, a, s] = await Promise.all([
      supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('internship_id', internship.id).eq('status', 'present'),
      supabase.from('assignments').select('*', { count: 'exact', head: true }).eq('internship_id', internship.id),
      supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('student_id', user!.id),
    ])
    presentDays = p.count ?? 0
    totalAssignments = a.count ?? 0
    submitted = s.count ?? 0
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Student Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Welcome to your MCL internship portal</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error.message}</div>
      )}

      {internship ? (
        <div className="grid md:grid-cols-5 gap-6">
          {/* Details & Report Upload (Left Column) */}
          <div className="md:col-span-3 space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Internship Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-400 text-xs">Mentor</p><p className="font-semibold text-gray-800 mt-0.5">{internship.mentor?.full_name || 'Not assigned yet'}</p></div>
                <div><p className="text-gray-400 text-xs">Period</p><p className="font-semibold text-gray-800 mt-0.5">{internship.start_date} → {internship.end_date}</p></div>
                <div><p className="text-gray-400 text-xs">Status</p>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${internship.is_active ? 'bg-green-150 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {internship.is_active ? 'Active' : 'Completed'}
                  </span>
                </div>
                {internship.certificate_url && (
                  <div><p className="text-gray-400 text-xs">Certificate</p>
                    <a href={internship.certificate_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-semibold block mt-1">Download Certificate →</a>
                  </div>
                )}
              </div>
            </div>

            <ProjectReportUpload
              internshipId={internship.id}
              currentReportUrl={internship.project_report_url}
              currentProjectTitle={internship.project_title}
            />
          </div>

          {/* Stats Overview (Right Column) */}
          <div className="md:col-span-2 space-y-4">
            {[
              { label: 'Days Present', value: presentDays, icon: Calendar, color: 'text-green-700 bg-green-50' },
              { label: 'Assignments',  value: totalAssignments, icon: ClipboardList, color: 'text-blue-700 bg-blue-50' },
              { label: 'Submitted',    value: submitted, icon: CheckCircle2, color: 'text-purple-700 bg-purple-50' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 leading-none">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 shadow-sm">
          No internship record found. Please contact your training office.
        </div>
      )}
    </div>
  )
}
