import { createClient } from '@/lib/supabase/server'
import ApplicationActions from './ApplicationActions'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function ApplicationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('role, area').eq('id', user.id).maybeSingle()
  const isAdminGlobal = profile?.area === 'Headquarters'

  const { data: applications, error } = await supabase
    .from('applications')
    .select(`
      id, status, applied_at, lor_url, student_id, student_name, student_email, employee_code, roll_no, university,
      student:profiles!applications_student_id_fkey(full_name, email),
      referrer:profiles!applications_referred_by_fkey(full_name, area)
    `)
    .order('applied_at', { ascending: false })

  // Filter based on admin scope
  const filteredApps = (applications || []).filter((app: any) => {
    if (isAdminGlobal) {
      // Global Admins see pending HQ applications
      return app.status === 'pending_hq' || app.status === 'pending'
    } else {
      // Area Admins see pending area applications OR approved applications with no student account linked yet
      const matchesArea = app.referrer?.area === profile?.area
      const isPendingArea = app.status === 'pending_area'
      const isApprovedButNotRegistered = app.status === 'approved' && !app.student_id
      return matchesArea && (isPendingArea || isApprovedButNotRegistered)
    }
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Applications</h1>
      <p className="text-gray-500 text-sm mb-6">
        {isAdminGlobal 
          ? 'Screen incoming Letter of Recommendation submissions and route them to local Area Admins' 
          : `Review and approve forwarded Letter of Recommendation submissions for ${profile?.area || 'your'} Area`}
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          Error loading applications: {error.message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {!filteredApps.length ? (
          <div className="p-8 text-center text-gray-400">No pending applications found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Referred by</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Employee Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Area</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Applied</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredApps.map((app: any) => {
                const displayName = app.student?.full_name || app.student_name || 'Anonymous Student'
                const displayEmail = app.student?.email || app.student_email || 'No Email'

                return (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{displayName}</p>
                      <p className="text-gray-400 text-xs">{displayEmail}</p>
                      {(app.roll_no || app.university) && (
                        <p className="text-gray-400 text-[10px] mt-0.5">
                          {app.roll_no ? `${app.roll_no} • ` : ''}{app.university}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{app.referrer?.full_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{app.employee_code || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                        {app.referrer?.area || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(app.applied_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        app.status === 'approved' ? 'bg-green-100 text-green-700' :
                        app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {app.status === 'pending_hq' || app.status === 'pending' ? 'HQ Screening' :
                         app.status === 'pending_area' ? 'Area Review' :
                         app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ApplicationActions
                        applicationId={app.id}
                        studentId={app.student_id}
                        studentEmail={displayEmail}
                        studentName={displayName}
                        lorUrl={app.lor_url}
                        currentStatus={app.status}
                        isAdminGlobal={isAdminGlobal}
                        rollNo={app.roll_no}
                        university={app.university}
                        area={app.referrer?.area}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
