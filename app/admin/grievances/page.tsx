import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SupportTicketsPanel from './SupportTicketsPanel'

export const revalidate = 0

export default async function AdminGrievancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, area')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/login')

  const isHqAdmin = !profile.area || profile.area === 'Headquarters'
  const userArea = profile.area || 'Headquarters'

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
      areas = [{ name: 'Headquarters' }, { name: 'Talcher' }, { name: 'Jagannath' }, { name: 'Lingaraj' }, { name: 'Subhadra' }]
    }
  } catch (err) {
    areas = [{ name: 'Headquarters' }, { name: 'Talcher' }, { name: 'Jagannath' }, { name: 'Lingaraj' }, { name: 'Subhadra' }]
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Helpdesk & Support Center</h1>
        <p className="text-sm text-slate-500">
          Manage and resolve support tickets filed by interns — stored directly in Area Google Drive.
        </p>
      </div>

      <SupportTicketsPanel
        userArea={userArea}
        isHqAdmin={isHqAdmin}
        areas={areas}
      />
    </div>
  )
}
