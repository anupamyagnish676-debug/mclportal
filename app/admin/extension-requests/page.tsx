import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import AreaSelector from '../interns/AreaSelector'
import AdminExtensionActions from './AdminExtensionActions'

export const revalidate = 0

export default async function AdminExtensionRequestsPage({
  searchParams,
}: {
  searchParams: { area?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, area')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/login')

  const isAdminGlobal = profile.area === 'Headquarters'
  const adminArea = profile.area || ''
  const selectedArea = isAdminGlobal ? (searchParams.area || '') : adminArea

  // Fetch areas
  let areas: { name: string }[] = []
  try {
    const { data: areasData } = await supabase
      .from('areas')
      .select('name')
      .order('name', { ascending: true })
    if (areasData && areasData.length > 0) {
      areas = areasData
    } else {
      areas = [{ name: 'Talcher' }, { name: 'Jagannath' }, { name: 'Lingaraj' }, { name: 'Subhadra' }, { name: 'Headquarters' }]
    }
  } catch (err) {
    areas = [{ name: 'Talcher' }, { name: 'Jagannath' }, { name: 'Lingaraj' }, { name: 'Subhadra' }, { name: 'Headquarters' }]
  }

  const adminClient = createAdminClient()

  // Fetch extension requests approved by mentor
  const { data: requests } = await adminClient
    .from('extension_requests')
    .select(`
      id,
      requested_end_date,
      reason,
      mentor_status,
      mentor_remarks,
      admin_status,
      admin_remarks,
      student:profiles!extension_requests_student_id_fkey(full_name, university, area)
    `)
    .eq('mentor_status', 'approved')
    .order('created_at', { ascending: false })

  // Filter by area
  const filteredRequests = (requests || []).filter((r: any) => {
    if (!r.student) return false
    if (selectedArea) {
      return r.student.area === selectedArea
    }
    return true
  }).map((r: any) => ({
    id: r.id,
    requested_end_date: r.requested_end_date,
    reason: r.reason,
    mentor_status: r.mentor_status,
    mentor_remarks: r.mentor_remarks,
    admin_status: r.admin_status,
    admin_remarks: r.admin_remarks,
    student: {
      full_name: r.student.full_name || 'N/A',
      university: r.student.university || 'N/A',
      area: r.student.area || 'N/A'
    }
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Confirm Extensions</h1>
          <p className="text-sm text-gray-500">
            Review and approve internship extensions recommended by project mentors.
          </p>
        </div>
        {isAdminGlobal && (
          <div className="flex items-center gap-2">
            <AreaSelector selectedArea={selectedArea} areas={areas} />
          </div>
        )}
      </div>

      <AdminExtensionActions initialRequests={filteredRequests} />
    </div>
  )
}
