import { NextResponse } from 'next/server'
import { isGDriveConfigured, getOrCreateStudentFolder } from '@/lib/gdrive'

export async function GET() {
  const config = {
    USE_GDRIVE_STORAGE: process.env.USE_GDRIVE_STORAGE || 'MISSING',
    GDRIVE_FOLDER_ID: process.env.GDRIVE_FOLDER_ID ? `PRESENT (${process.env.GDRIVE_FOLDER_ID})` : 'MISSING',
    GDRIVE_CLIENT_ID: process.env.GDRIVE_CLIENT_ID ? 'PRESENT' : 'MISSING',
    GDRIVE_CLIENT_SECRET: process.env.GDRIVE_CLIENT_SECRET ? 'PRESENT' : 'MISSING',
    GDRIVE_REFRESH_TOKEN: process.env.GDRIVE_REFRESH_TOKEN ? 'PRESENT' : 'MISSING',
    isGDriveConfigured: isGDriveConfigured(),
  }

  let testResult = 'Not executed (isGDriveConfigured is false)'
  if (isGDriveConfigured()) {
    try {
      const folderId = await getOrCreateStudentFolder({
        studentName: 'VERCEL_TEST_STUDENT',
        studentId: 'test_123',
        serialNo: '9999',
      })
      testResult = `SUCCESS! Folder created/found in Google Drive. ID: ${folderId}`
    } catch (e: any) {
      testResult = `ERROR: ${e.message}`
    }
  }

  return NextResponse.json({ config, testResult }, { headers: { 'Cache-Control': 'no-store' } })
}
