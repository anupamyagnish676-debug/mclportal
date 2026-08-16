import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  saveHelpdeskTicketToGDrive,
  getHelpdeskTicketsFromGDrive,
  isGDriveConfigured,
  uploadFileToGDrive,
  getOrCreateHelpdeskAreaFolder
} from '@/lib/gdrive'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, area, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const userArea = profile.area || 'Headquarters'

    if (profile.role === 'student') {
      const tickets = await getHelpdeskTicketsFromGDrive(userArea, user.id)
      return NextResponse.json({ tickets })
    }

    if (profile.role === 'admin') {
      const targetArea = req.nextUrl.searchParams.get('area') || userArea
      const tickets = await getHelpdeskTicketsFromGDrive(targetArea)
      return NextResponse.json({ tickets })
    }

    return NextResponse.json({ tickets: [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, full_name, area')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const formData = await req.formData()
    const category = (formData.get('category') as string) || 'General Issue'
    const subject = (formData.get('subject') as string) || ''
    const description = (formData.get('description') as string) || ''
    const file = formData.get('file') as File | null

    if (!subject.trim() || !description.trim()) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 })
    }

    // Tickets raised by Admins or non-students go directly to Headquarters Central Admin queue
    const areaName = profile.role === 'admin' ? 'Headquarters' : (profile.area || 'Headquarters')
    const ticketId = `TCK-${Date.now().toString().slice(-6)}`
    let attachmentUrl: string | null = null

    // Upload attachment to Area Drive -> Helpdesk_Tickets folder if file attached
    if (file && isGDriveConfigured()) {
      try {
        const folderId = await getOrCreateHelpdeskAreaFolder(areaName)
        const fileName = `${ticketId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const buffer = Buffer.from(await file.arrayBuffer())

        const gdriveRes = await uploadFileToGDrive({
          buffer,
          fileName,
          mimeType: file.type || 'application/octet-stream',
          folderId,
        })
        attachmentUrl = gdriveRes.webViewLink
      } catch (e: any) {
        console.warn('[HELPDESK] Attachment upload notice:', e.message)
      }
    }

    const ticketRecord = {
      id: ticketId,
      studentId: user.id,
      studentName: profile.full_name || 'Student',
      area: areaName,
      category,
      subject: subject.trim(),
      description: description.trim(),
      status: 'open' as const,
      attachmentUrl,
      resolutionNotes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save ticket record directly into Google Drive (Helpdesk_Tickets.json)
    await saveHelpdeskTicketToGDrive(ticketRecord)

    return NextResponse.json({ success: true, ticket: ticketRecord })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
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

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    const { ticketId, area, status, resolutionNotes } = await req.json()
    if (!ticketId || !area) {
      return NextResponse.json({ error: 'Missing ticketId or area' }, { status: 400 })
    }

    const tickets = await getHelpdeskTicketsFromGDrive(area)
    const ticket = tickets.find((t: any) => t.id === ticketId)
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const updatedTicket = {
      ...ticket,
      status: status || ticket.status,
      resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : ticket.resolutionNotes,
      updatedAt: new Date().toISOString(),
    }

    // Update in Google Drive
    await saveHelpdeskTicketToGDrive(updatedTicket)

    return NextResponse.json({ success: true, ticket: updatedTicket })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
