import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGDriveFileStream } from '@/lib/gdrive'

/**
 * GET /api/student/photo-proxy?studentId=xxx
 * 
 * Proxies the student passport photo from Google Drive (or Supabase)
 * so it can be embedded in the ID card without CORS/auth issues.
 * 
 * Access is scoped:
 *  - A student can only fetch their own photo
 *  - Admins/mentors can fetch any student's photo
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const requestedStudentId = req.nextUrl.searchParams.get('studentId') || user.id

    // Access control: students can only fetch their own photo
    if (profile?.role === 'student' && requestedStudentId !== user.id) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const adminClient = createAdminClient()

    // Fetch the photo document record
    const { data: photoDoc } = await adminClient
      .from('student_documents')
      .select('file_url, file_path, status')
      .eq('student_id', requestedStudentId)
      .eq('doc_type', 'photo')
      .maybeSingle()

    if (!photoDoc?.file_url && !photoDoc?.file_path) {
      return new NextResponse('No photo found', { status: 404 })
    }

    // Case 1: Google Drive file
    if (photoDoc.file_path?.startsWith('gdrive:')) {
      const fileId = photoDoc.file_path.replace('gdrive:', '')

      try {
        const { stream, mimeType } = await getGDriveFileStream(fileId)

        return new NextResponse(stream as any, {
          headers: {
            'Content-Type': mimeType || 'image/jpeg',
            'Cache-Control': 'private, max-age=3600',
          },
        })
      } catch (err: any) {
        console.error('[photo-proxy] GDrive stream failed:', err.message)
        return new NextResponse('Failed to fetch photo from Google Drive', { status: 500 })
      }
    }

    // Case 2: Supabase storage — generate a fresh signed URL and redirect
    if (photoDoc.file_path && !photoDoc.file_path.startsWith('gdrive:')) {
      const { data: signedData } = await adminClient.storage
        .from('documents')
        .createSignedUrl(photoDoc.file_path, 3600)

      if (signedData?.signedUrl) {
        return NextResponse.redirect(signedData.signedUrl, { status: 302 })
      }
    }

    // Case 3: Fallback — try to use file_url directly (old records)
    if (photoDoc.file_url) {
      return NextResponse.redirect(photoDoc.file_url, { status: 302 })
    }

    return new NextResponse('Photo not available', { status: 404 })
  } catch (e: any) {
    console.error('[photo-proxy] Error:', e)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
