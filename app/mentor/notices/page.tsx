import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import UserNoticeFeed from '@/components/UserNoticeFeed'

export const revalidate = 0

export default async function MentorNoticesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, area')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'mentor') redirect('/login')

  const adminClient = createAdminClient()
  const { data: notices } = await adminClient
    .from('notices')
    .select(`
      *,
      created_by_profile:profiles!notices_created_by_fkey(full_name),
      notice_reads(user_id)
    `)
    .order('created_at', { ascending: false })

  // Filter notices for mentors in their area
  const filtered = (notices || []).filter((n: any) => {
    const roleMatches = n.target_roles.includes('mentor')
    const areaMatches = n.target_areas.includes('all') || n.target_areas.includes(profile.area)
    return roleMatches && areaMatches
  }).map((n: any) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    source_area: n.source_area || 'N/A',
    priority: n.priority || 'normal',
    created_at: n.created_at,
    created_by_profile: n.created_by_profile ? {
      full_name: n.created_by_profile.full_name || 'Admin'
    } : undefined,
    notice_reads: n.notice_reads || []
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Notice Board</h1>
        <p className="text-sm text-gray-500">Announcements, updates, and notices from Headquarters and Training Admins.</p>
      </div>

      <UserNoticeFeed initialNotices={filtered} currentUserId={profile.id} />
    </div>
  )
}
