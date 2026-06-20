import { createClient } from '@/lib/supabase/server'

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
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Student Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Welcome to your MCL internship portal</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error.message}</div>
      )}

      {internship ? (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <h2 className="font-semibold text-gray-800 mb-3">Internship details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-400">Mentor</p><p className="font-medium">{internship.mentor?.full_name || 'Not assigned yet'}</p></div>
              <div><p className="text-gray-400">Period</p><p className="font-medium">{internship.start_date} → {internship.end_date}</p></div>
              <div><p className="text-gray-400">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${internship.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {internship.is_active ? 'Active' : 'Completed'}
                </span>
              </div>
              {internship.certificate_url && (
                <div><p className="text-gray-400">Certificate</p>
                  <a href={internship.certificate_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Download →</a>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Days Present', value: presentDays, icon: '📅', color: 'text-green-700 bg-green-50' },
              { label: 'Assignments',  value: totalAssignments, icon: '📝', color: 'text-blue-700 bg-blue-50' },
              { label: 'Submitted',    value: submitted, icon: '✅', color: 'text-purple-700 bg-purple-50' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${s.color}`}>{s.icon}</div>
                <div><p className="text-xl font-bold text-gray-900">{s.value}</p><p className="text-xs text-gray-500">{s.label}</p></div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
          No internship record found. Please contact your training office.
        </div>
      )}
    </div>
  )
}
