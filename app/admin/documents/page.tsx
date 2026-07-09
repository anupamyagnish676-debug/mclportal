import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import AreaSelector from '../interns/AreaSelector'
import DocumentVerifier from './DocumentVerifier'

export const revalidate = 0

export default async function AdminDocumentsPage({
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

  // Fetch all student profiles
  let studentQuery = adminClient
    .from('profiles')
    .select('id, full_name, email, area')
    .eq('role', 'student')

  if (selectedArea) {
    studentQuery = studentQuery.eq('area', selectedArea)
  }

  const { data: students, error: stuErr } = await studentQuery
  if (stuErr) {
    return (
      <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100">
        Error loading students: {stuErr.message}
      </div>
    )
  }

  const studentIds = (students || []).map(s => s.id)
  let documents: any[] = []

  if (studentIds.length > 0) {
    const { data, error: docErr } = await adminClient
      .from('student_documents')
      .select('*')
      .in('student_id', studentIds)
      .order('uploaded_at', { ascending: false })

    if (docErr) {
      return (
        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100">
          Error loading documents: {docErr.message}
        </div>
      )
    }
    documents = data || []
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Onboarding Document Verification</h1>
          <p className="text-sm text-gray-500">
            Review and approve candidate verification files — {selectedArea ? `${selectedArea} Area` : 'All Areas'}
          </p>
        </div>
        {isAdminGlobal && (
          <div className="flex items-center gap-2">
            <AreaSelector selectedArea={selectedArea} areas={areas} />
          </div>
        )}
      </div>

      <DocumentVerifier
        students={students || []}
        initialDocuments={documents}
      />
    </div>
  )
}
