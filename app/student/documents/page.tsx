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

  // Generate signed URLs in bulk server-side
  const paths = (documents || []).map((d: any) => d.file_path).filter(Boolean)
  let resolvedDocs = documents || []
  if (paths.length > 0) {
    const { data: signedUrls } = await adminClient.storage
      .from('documents')
      .createSignedUrls(paths, 60 * 60 * 24 * 365) // 1 year expiry

    resolvedDocs = (documents || []).map((doc: any) => {
      const matched = signedUrls?.find((s: any) => s.path === doc.file_path)
      return {
        ...doc,
        file_url: matched?.signedUrl || doc.file_url
      }
    })
  }

  const typedDocs = (resolvedDocs || []).map((d: any) => ({
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
