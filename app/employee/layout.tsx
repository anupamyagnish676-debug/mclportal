import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'employee') redirect('/login')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="employee" userName={profile.full_name || user.email || 'Employee'} />
      <main className="flex-1 ml-56 p-8">{children}</main>
    </div>
  )
}
