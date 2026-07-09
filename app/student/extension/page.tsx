import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ExtensionForm from './ExtensionForm'

export default async function StudentExtensionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'student') redirect('/login')

  const adminClient = createAdminClient()
  
  // Get active internship
  const { data: internship } = await adminClient
    .from('internships')
    .select('id, end_date')
    .eq('student_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!internship) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-150 text-center space-y-2">
        <h2 className="text-lg font-bold text-gray-900">No Active Internship Record</h2>
        <p className="text-sm text-gray-500">You do not have any active internship to extend.</p>
      </div>
    )
  }

  // Fetch any existing extension requests (recent one)
  const { data: request } = await adminClient
    .from('extension_requests')
    .select('*')
    .eq('internship_id', internship.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Internship Extension</h1>
        <p className="text-sm text-gray-500">Apply for extension of training period if required for project completion.</p>
      </div>

      <ExtensionForm
        currentEndDate={internship.end_date}
        existingRequest={request || undefined}
      />
    </div>
  )
}
