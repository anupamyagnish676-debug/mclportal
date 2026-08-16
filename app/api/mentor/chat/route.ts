import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { saveMentorMessageToGDrive, getMentorMessagesFromGDrive } from '@/lib/gdrive'

export async function GET(req: NextRequest) {
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

    let studentName = ''
    let areaName = profile.area || 'Headquarters'

    if (profile.role === 'student') {
      studentName = profile.full_name || 'Student'
    } else if (profile.role === 'mentor') {
      const paramStudentId = req.nextUrl.searchParams.get('studentId')
      if (!paramStudentId) {
        return NextResponse.json({ error: 'studentId param required for mentors' }, { status: 400 })
      }
      const { data: studentProf } = await adminClient
        .from('profiles')
        .select('full_name, area')
        .eq('id', paramStudentId)
        .maybeSingle()

      if (!studentProf) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      studentName = studentProf.full_name
      areaName = studentProf.area || areaName
    } else {
      return NextResponse.json({ messages: [] })
    }

    const messages = await getMentorMessagesFromGDrive({ studentName, areaName })
    return NextResponse.json({ messages })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { content, targetStudentId } = await req.json()
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, full_name, area')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    let studentName = ''
    let areaName = profile.area || 'Headquarters'

    if (profile.role === 'student') {
      studentName = profile.full_name || 'Student'
    } else if (profile.role === 'mentor') {
      if (!targetStudentId) {
        return NextResponse.json({ error: 'targetStudentId required when mentor sends message' }, { status: 400 })
      }
      const { data: studentProf } = await adminClient
        .from('profiles')
        .select('full_name, area')
        .eq('id', targetStudentId)
        .maybeSingle()

      if (!studentProf) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      studentName = studentProf.full_name
      areaName = studentProf.area || areaName
    } else {
      return NextResponse.json({ error: 'Only student or mentor can chat' }, { status: 403 })
    }

    const msgObj = {
      id: `MSG-${Date.now()}`,
      senderId: user.id,
      senderName: profile.full_name || 'User',
      senderRole: profile.role,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    }

    // Save message directly into Area Google Drive ({Student_Name}_Chat.json)
    await saveMentorMessageToGDrive({
      studentName,
      studentId: profile.role === 'student' ? user.id : targetStudentId,
      areaName,
      message: msgObj,
    })

    return NextResponse.json({ success: true, message: msgObj })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
