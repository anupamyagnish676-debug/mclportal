import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  console.log('[ROOT PAGE] User found:', !!user, user?.id ?? 'null')

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  console.log('[ROOT PAGE] Profile role:', profile?.role ?? 'null')

  const role = profile?.role
  if (role === 'admin') redirect('/admin')
  if (role === 'mentor') redirect('/mentor')
  if (role === 'employee') redirect('/employee')
  redirect('/student')
}
