import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, area')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }

    const format = req.nextUrl.searchParams.get('format') || 'xlsx'
    const targetArea = req.nextUrl.searchParams.get('area') || 'all'

    // Query internships with profile & area details
    let query = adminClient
      .from('internships')
      .select(`
        id,
        student_id,
        mentor_id,
        area_id,
        department_id,
        start_date,
        end_date,
        is_active,
        is_paid,
        stipend_amount,
        serial_number,
        student:profiles!internships_student_id_fkey(full_name, email, phone, role),
        mentor:profiles!internships_mentor_id_fkey(full_name, email),
        area:areas!internships_area_id_fkey(name),
        department:departments!internships_department_id_fkey(name)
      `)
      .order('id', { ascending: false })

    const { data: rawInternships, error } = await query

    if (error) {
      console.error('[EXPORT-API] Query error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let internships = rawInternships || []

    if (targetArea !== 'all' && targetArea !== 'All Areas') {
      internships = internships.filter((item: any) => {
        const areaName = item.area?.name || 'Headquarters'
        return areaName.toLowerCase() === targetArea.toLowerCase()
      })
    }

    // Map rows into formatted administrative dataset
    const exportRows = internships.map((item: any, index: number) => {
      const studentName = item.student?.full_name || 'N/A'
      const studentEmail = item.student?.email || 'N/A'
      const areaName = item.area?.name === 'Headquarters' ? 'Headquarters (Central)' : (item.area?.name || 'N/A')
      const deptName = item.department?.name || 'General'
      const mentorName = item.mentor?.full_name || 'Unassigned'
      const isPaidText = item.is_paid ? `Paid (₹${item.stipend_amount || 0})` : 'Unpaid'
      const statusText = item.is_active ? 'Active' : 'Completed'

      return {
        'S.No': index + 1,
        'Serial / Registration ID': item.serial_number || item.id,
        'Intern Name': studentName,
        'Email Address': studentEmail,
        'Area Location': areaName,
        'Department': deptName,
        'Assigned Mentor': mentorName,
        'Start Date': item.start_date || 'N/A',
        'End Date': item.end_date || 'N/A',
        'Stipend Type': isPaidText,
        'Internship Status': statusText,
      }
    })

    if (format === 'xlsx') {
      // Create Excel workbook using xlsx package
      const worksheet = XLSX.utils.json_to_sheet(exportRows)
      
      // Auto column width adjustment
      const colWidths = Object.keys(exportRows[0] || {}).map(key => ({
        wch: Math.max(key.length + 3, 18)
      }))
      worksheet['!cols'] = colWidths

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Interns Register')

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })

      const fileName = `MCL_Master_Interns_Register_${Date.now()}.xlsx`
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      })
    }

    if (format === 'pdf') {
      // Create PDF Summary document using pdf-lib
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      let page = pdfDoc.addPage([595.28, 841.89]) // A4
      const { width, height } = page.getSize()

      // Header Banner
      page.drawRectangle({
        x: 0,
        y: height - 80,
        width,
        height: 80,
        color: rgb(0.04, 0.3, 0.2), // Dark Emerald
      })

      page.drawText('MAHANADI COALFIELDS LIMITED', {
        x: 30,
        y: height - 35,
        size: 14,
        font: fontBold,
        color: rgb(1, 1, 1),
      })

      page.drawText(`Master Interns Register Report — ${targetArea === 'all' ? 'All Areas' : targetArea}`, {
        x: 30,
        y: height - 55,
        size: 10,
        font,
        color: rgb(0.8, 0.95, 0.85),
      })

      let y = height - 110

      // Summary statistics
      const totalCount = exportRows.length
      const activeCount = exportRows.filter(r => r['Internship Status'] === 'Active').length
      const paidCount = exportRows.filter(r => r['Stipend Type'].startsWith('Paid')).length

      page.drawText(`Total Registered Interns: ${totalCount}  |  Active: ${activeCount}  |  Completed: ${totalCount - activeCount}  |  Paid: ${paidCount}`, {
        x: 30,
        y,
        size: 9,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      })

      y -= 25

      // Render table rows
      exportRows.slice(0, 35).forEach((row, i) => {
        if (y < 40) {
          page = pdfDoc.addPage([595.28, 841.89])
          y = height - 50
        }

        const line = `${row['S.No']}. ${row['Intern Name']} | ${row['Area Location']} | ${row['Department']} | Mentor: ${row['Assigned Mentor']} [${row['Internship Status']}]`
        
        page.drawText(line, {
          x: 30,
          y,
          size: 8,
          font,
          color: rgb(0.1, 0.1, 0.1),
        })

        y -= 18
      })

      const pdfBytes = await pdfDoc.save()
      const fileName = `MCL_Master_Interns_Report_${Date.now()}.pdf`

      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      })
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Export error' }, { status: 500 })
  }
}
