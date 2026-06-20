import { createClient } from '@/lib/supabase/server'

export default async function MentorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: internships, error } = await supabase
    .from('internships')
    .select(`id, start_date, end_date, is_active, student:profiles!internships_student_id_fkey(full_name, email)`)
    .eq('mentor_id', user!.id)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Mentor Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your assigned interns</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          Error loading interns: {error.message}
        </div>
      )}

      <h2 className="font-semibold text-gray-700 mb-3">Your interns</h2>
      <div className="grid gap-3">
        {!internships?.length ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
            No interns assigned yet. Ask admin to assign you as mentor for a student.
          </div>
        ) : internships.map((i: any) => (
          <div key={i.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
                {i.student?.full_name?.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-900">{i.student?.full_name}</p>
                <p className="text-xs text-gray-400">{i.student?.email}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{i.start_date} → {i.end_date}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${i.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {i.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
