import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import GrievanceForm from './GrievanceForm'

export default async function StudentGrievancePage() {
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
  const { data: grievances } = await adminClient
    .from('grievances')
    .select('*')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Grievance Redressal</h1>
        <p className="text-sm text-gray-500">File complaints, raise issues, or request administrative support.</p>
      </div>

      <GrievanceForm initialGrievances={grievances || []} />
    </div>
  )
}
