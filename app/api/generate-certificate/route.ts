import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    const { internshipId, studentName } = await req.json()
    const adminClient = createAdminClient()

    const { data: internship, error: fetchError } = await adminClient
      .from('internships')
      .select('*, student:profiles!internships_student_id_fkey(full_name), mentor:profiles!internships_mentor_id_fkey(full_name)')
      .eq('id', internshipId)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })
    if (!internship) return NextResponse.json({ error: 'Internship not found' }, { status: 404 })

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([842, 595])
    const { width, height } = page.getSize()

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

    page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: rgb(0.09, 0.53, 0.27), borderWidth: 3 })
    page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: rgb(0.09, 0.53, 0.27), borderWidth: 1 })

    page.drawText('MAHANADI COALFIELDS LIMITED', { x: 180, y: height - 80, size: 24, font: boldFont, color: rgb(0.09, 0.53, 0.27) })
    page.drawText('A Subsidiary of Coal India Limited', { x: 280, y: height - 108, size: 12, font: regularFont, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('CERTIFICATE OF INTERNSHIP', { x: 230, y: height - 160, size: 20, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    page.drawText('This is to certify that', { x: 290, y: height - 220, size: 14, font: regularFont, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(studentName || internship.student?.full_name || 'Intern', { x: 260, y: height - 260, size: 22, font: boldFont, color: rgb(0.09, 0.53, 0.27) })
    page.drawText('has successfully completed the internship training at', { x: 200, y: height - 300, size: 13, font: regularFont, color: rgb(0.3, 0.3, 0.3) })
    page.drawText('Mahanadi Coalfields Limited', { x: 270, y: height - 330, size: 15, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(`from  ${internship.start_date}  to  ${internship.end_date}`, { x: 295, y: height - 365, size: 13, font: regularFont, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(`Mentor: ${internship.mentor?.full_name || 'N/A'}`, { x: 80, y: 80, size: 11, font: regularFont, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('Training & Development Department', { x: 570, y: 80, size: 10, font: regularFont, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('Mahanadi Coalfields Limited', { x: 590, y: 65, size: 10, font: regularFont, color: rgb(0.4, 0.4, 0.4) })

    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = Buffer.from(pdfBytes)
    const filePath = `${internshipId}/certificate.pdf`

    const { error: uploadError } = await adminClient.storage
      .from('certificates')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from('certificates')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365) // 1 year

    if (signedUrlError) return NextResponse.json({ error: signedUrlError.message }, { status: 500 })

    const { error: updateError } = await adminClient
      .from('internships')
      .update({ certificate_url: signedUrlData.signedUrl })
      .eq('id', internshipId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ success: true, certificateUrl: signedUrlData.signedUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 })
  }
}
