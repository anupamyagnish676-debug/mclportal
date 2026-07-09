import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import NoticeForm from './NoticeForm'
import NoticeInbox from './NoticeInbox'

export const revalidate = 0

export default async function AdminNoticesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, area')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/login')

  const isAdminGlobal = profile.area === 'Headquarters'

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

  // Fetch notices
  const adminClient = createAdminClient()
  const { data: notices } = await adminClient
    .from('notices')
    .select(`
      *,
      created_by_profile:profiles!notices_created_by_fkey(full_name, role),
      notice_reads(user_id)
    `)
    .order('created_at', { ascending: false })

  const typedNotices = (notices || []).map((n: any) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    created_by: n.created_by,
    source_area: n.source_area || 'N/A',
    is_hq_notice: n.is_hq_notice,
    target_roles: n.target_roles || [],
    target_areas: n.target_areas || [],
    priority: n.priority || 'normal',
    created_at: n.created_at,
    created_by_profile: n.created_by_profile ? {
      full_name: n.created_by_profile.full_name || 'Admin',
      role: n.created_by_profile.role || 'admin'
    } : undefined,
    notice_reads: n.notice_reads || []
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Notice Board Management</h1>
        <p className="text-sm text-gray-500">
          Post local area notices, or view and forward Headquarters announcements to your local mentors/students.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Compose Form */}
        <div className="lg:col-span-1">
          <NoticeForm
            areas={areas}
            isAdminGlobal={isAdminGlobal}
            currentArea={profile.area || ''}
          />
        </div>

        {/* Notices Inbox/Sent Feed */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 px-1">Notice Inbox & Analytics</h2>
          <NoticeInbox
            initialNotices={typedNotices}
            isAdminGlobal={isAdminGlobal}
            currentAdminId={profile.id}
          />
        </div>
      </div>
    </div>
  )
}
