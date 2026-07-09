import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import AreaSelector from '../interns/AreaSelector'
import GrievancePanel from './GrievancePanel'

export const revalidate = 0

export default async function AdminGrievancesPage({
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

  // Fetch grievances
  const adminClient = createAdminClient()
  let query = adminClient
    .from('grievances')
    .select(`
      *,
      student:profiles!grievances_student_id_fkey(full_name, area, university)
    `)
    .order('created_at', { ascending: false })

  const { data: grievances, error } = await query

  // Filter grievances by area
  const filteredGrievances = (grievances || []).filter((g: any) => {
    if (!g.student) return false
    if (selectedArea) {
      return g.student.area === selectedArea
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Grievance Redressal Board</h1>
          <p className="text-sm text-gray-500">
            Monitor and resolve issues filed by interns — {selectedArea ? `${selectedArea} Area` : 'All Areas'}
          </p>
        </div>
        {isAdminGlobal && (
          <div className="flex items-center gap-2">
            <AreaSelector selectedArea={selectedArea} areas={areas} />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100">
          Error loading grievances: {error.message}
        </div>
      )}

      <GrievancePanel initialGrievances={filteredGrievances} />
    </div>
  )
}
