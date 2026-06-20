import { createClient } from '@/lib/supabase/server'

export default async function StudentAttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: internship } = await supabase.from('internships').select('id').eq('student_id', user!.id).maybeSingle()

  const { data: records, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('internship_id', internship?.id || '')
    .order('date', { ascending: false })

  const present = records?.filter(r => r.status === 'present').length || 0
  const absent  = records?.filter(r => r.status === 'absent').length || 0
  const halfDay = records?.filter(r => r.status === 'half-day').length || 0
  const total   = records?.length || 0
  const pct     = total ? Math.round((present / total) * 100) : 0

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Attendance</h1>
      <p className="text-gray-500 text-sm mb-6">Your attendance record</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error.message}</div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Present', value: present, color: 'bg-green-50 text-green-700' },
          { label: 'Absent', value: absent, color: 'bg-red-50 text-red-700' },
          { label: 'Half Day', value: halfDay, color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Attendance %', value: `${pct}%`, color: 'bg-blue-50 text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!records?.length ? (
              <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">No records yet</td></tr>
            ) : records.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-700">{r.date}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    r.status === 'present' ? 'bg-green-100 text-green-700' :
                    r.status === 'absent' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
