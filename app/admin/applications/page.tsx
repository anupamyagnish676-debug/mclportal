import { createClient } from '@/lib/supabase/server'
import ApplicationActions from './ApplicationActions'

export default async function ApplicationsPage() {
  const supabase = await createClient()

  const { data: applications, error } = await supabase
    .from('applications')
    .select(`
      id, status, applied_at, lor_url, student_id,
      student:profiles!applications_student_id_fkey(full_name, email),
      referrer:profiles!applications_referred_by_fkey(full_name)
    `)
    .order('applied_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Applications</h1>
      <p className="text-gray-500 text-sm mb-6">Review Letter of Recommendation submissions</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          Error loading applications: {error.message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {!applications?.length ? (
          <div className="p-8 text-center text-gray-400">No applications yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Referred by</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Applied</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {applications.map((app: any) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{app.student?.full_name}</p>
                    <p className="text-gray-400 text-xs">{app.student?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{app.referrer?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(app.applied_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      app.status === 'approved' ? 'bg-green-100 text-green-700' :
                      app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{app.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ApplicationActions
                      applicationId={app.id}
                      studentId={app.student_id}
                      studentEmail={app.student?.email}
                      studentName={app.student?.full_name}
                      lorUrl={app.lor_url}
                      currentStatus={app.status}
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
