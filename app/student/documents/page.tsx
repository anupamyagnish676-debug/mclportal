import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import DocumentUpload from './DocumentUpload'

export const revalidate = 0

export default async function StudentDocumentsPage() {
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
  const { data: documents } = await adminClient
    .from('student_documents')
    .select('*')
    .eq('student_id', user.id)
    .order('uploaded_at', { ascending: false })

  const typedDocs = (documents || []).map((d: any) => ({
    id: d.id,
    doc_type: d.doc_type,
    file_url: d.file_url,
    status: d.status || 'pending',
    rejection_reason: d.rejection_reason || null,
    uploaded_at: d.uploaded_at
  }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Onboarding Documents</h1>
        <p className="text-sm text-gray-500">
          Upload required documents for internship verification.
        </p>
      </div>

      <DocumentUpload initialDocuments={typedDocs} />
    </div>
  )
}
