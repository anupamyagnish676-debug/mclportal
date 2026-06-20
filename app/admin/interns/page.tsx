import { createClient } from '@/lib/supabase/server'
import InternActions from './InternActions'

export default async function InternsPage() {
  const supabase = await createClient()

  const { data: internships, error } = await supabase
    .from('internships')
    .select(`
      id, start_date, end_date, is_active, certificate_url, certificate_approved, student_id,
      student:profiles!internships_student_id_fkey(id, full_name, email),
      mentor:profiles!internships_mentor_id_fkey(full_name)
    `)
    .order('start_date', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Interns</h1>
      <p className="text-gray-500 text-sm mb-6">Manage active and past internships</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          Error loading interns: {error.message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {!internships?.length ? (
          <div className="p-8 text-center text-gray-400">No internships found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mentor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {internships.map((i: any) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{i.student?.full_name}</p>
                    <p className="text-gray-400 text-xs">{i.student?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{i.mentor?.full_name || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{i.start_date} → {i.end_date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${i.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {i.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <InternActions
                      internshipId={i.id}
                      studentEmail={i.student?.email}
                      studentName={i.student?.full_name}
                      isActive={i.is_active}
                      hasCertificate={!!i.certificate_url}
                      mentorApproved={!!i.certificate_approved}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
