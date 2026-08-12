import { google } from 'googleapis'
import { Readable } from 'stream'
import { createAdminClient } from '@/lib/supabase/admin'

export function isGDriveConfigured(): boolean {
  if (process.env.USE_GDRIVE_STORAGE !== 'true') return false

  const hasOAuth = Boolean(
    process.env.GDRIVE_CLIENT_ID &&
    process.env.GDRIVE_CLIENT_SECRET &&
    process.env.GDRIVE_REFRESH_TOKEN &&
    process.env.GDRIVE_FOLDER_ID
  )

  const hasServiceAccount = Boolean(
    process.env.GDRIVE_CLIENT_EMAIL &&
    process.env.GDRIVE_PRIVATE_KEY &&
    process.env.GDRIVE_FOLDER_ID
  )

  return hasOAuth || hasServiceAccount
}

function getGDriveClient() {
  if (
    process.env.GDRIVE_CLIENT_ID &&
    process.env.GDRIVE_CLIENT_SECRET &&
    process.env.GDRIVE_REFRESH_TOKEN
  ) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GDRIVE_CLIENT_ID,
      process.env.GDRIVE_CLIENT_SECRET
    )
    oauth2Client.setCredentials({
      refresh_token: process.env.GDRIVE_REFRESH_TOKEN,
    })
    return google.drive({ version: 'v3', auth: oauth2Client })
  }

  const clientEmail = process.env.GDRIVE_CLIENT_EMAIL
  let privateKey = process.env.GDRIVE_PRIVATE_KEY
  if (privateKey) {
    privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })

  return google.drive({ version: 'v3', auth })
}

/**
 * Helper to fetch custom area Google Drive folder ID from Supabase
 */
export async function getAreaDriveFolderId(areaName?: string | null): Promise<string | undefined> {
  if (!areaName) return process.env.GDRIVE_FOLDER_ID
  try {
    const adminClient = createAdminClient()
    const { data } = await adminClient
      .from('areas')
      .select('gdrive_folder_id')
      .eq('name', areaName.trim())
      .maybeSingle()

    if (data?.gdrive_folder_id && data.gdrive_folder_id.trim()) {
      return data.gdrive_folder_id.trim()
    }
  } catch (err) {
    console.error('[GDRIVE] Error fetching area folder ID from DB:', err)
  }
  return process.env.GDRIVE_FOLDER_ID
}

/**
 * Find or create a dedicated subfolder for a student in Google Drive.
 * Structure: Area -> StudentName_Area_INT_SerialNo
 * Example: "Talcher/Rahul_Sharma_Talcher_INT_5"
 */
export async function getOrCreateStudentFolder(params: {
  studentName: string
  studentId: string
  serialNo?: string | null
  area?: string | null
}): Promise<string> {
  const drive = getGDriveClient()
  const areaCustomFolder = await getAreaDriveFolderId(params.area)
  const parentFolder = areaCustomFolder || process.env.GDRIVE_FOLDER_ID

  const rawArea = params.area && params.area.trim() ? params.area.trim() : 'Headquarters'
  const cleanArea = rawArea.replace(/[^a-zA-Z0-9]/g, '_')

  const cleanName = params.studentName.trim().replace(/[^a-zA-Z0-9]/g, '_')
  const refCode = params.serialNo ? `INT_${params.serialNo}` : `INT_${params.studentId.slice(0, 8)}`
  
  // Format: StudentName_Area_INT_SerialNo
  const studentFolderName = `${cleanName}_${cleanArea}_${refCode}`

  try {
    // Step 1: Find or Create Area Subfolder inside parentFolder
    let areaFolderId = parentFolder
    if (parentFolder) {
      const areaQuery = `'${parentFolder}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${cleanArea}' and trashed = false`
      const areaSearchRes = await drive.files.list({
        q: areaQuery,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })

      if (areaSearchRes.data.files && areaSearchRes.data.files.length > 0) {
        areaFolderId = areaSearchRes.data.files[0].id!
      } else {
        const areaCreateRes = await drive.files.create({
          requestBody: {
            name: cleanArea,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolder],
          },
          supportsAllDrives: true,
          fields: 'id',
        })
        areaFolderId = areaCreateRes.data.id!
      }
    }

    // Step 2: Find or Create Student Subfolder inside areaFolderId
    const studentQuery = `'${areaFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${studentFolderName}' and trashed = false`
    const studentSearchRes = await drive.files.list({
      q: studentQuery,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    if (studentSearchRes.data.files && studentSearchRes.data.files.length > 0) {
      return studentSearchRes.data.files[0].id!
    }

    const studentCreateRes = await drive.files.create({
      requestBody: {
        name: studentFolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: areaFolderId ? [areaFolderId] : undefined,
      },
      supportsAllDrives: true,
      fields: 'id',
    })

    return studentCreateRes.data.id!
  } catch (err: any) {
    console.error('[GDRIVE] Error in getOrCreateStudentFolder:', err.message)
    return parentFolder || ''
  }
}

/**
 * Delete a student's subfolder from Google Drive when an admin deletes the student.
 */
export async function deleteStudentFolderGDrive(params: {
  studentName: string
  studentId: string
  serialNo?: string | null
  area?: string | null
}): Promise<void> {
  if (!isGDriveConfigured()) return
  try {
    const drive = getGDriveClient()

    const rawArea = params.area && params.area.trim() ? params.area.trim() : 'Headquarters'
    const cleanArea = rawArea.replace(/[^a-zA-Z0-9]/g, '_')
    const cleanName = params.studentName.trim().replace(/[^a-zA-Z0-9]/g, '_')
    const refCode = params.serialNo ? `INT_${params.serialNo}` : `INT_${params.studentId.slice(0, 8)}`
    
    const studentFolderName = `${cleanName}_${cleanArea}_${refCode}`

    const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${studentFolderName}' and trashed = false`
    const searchRes = await drive.files.list({
      q,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      for (const file of searchRes.data.files) {
        if (file.id) {
          await drive.files.delete({ fileId: file.id, supportsAllDrives: true })
          console.log(`[GDRIVE] Deleted student folder: ${file.name} (${file.id})`)
        }
      }
    }
  } catch (err: any) {
    console.error('[GDRIVE] Error deleting student folder from Drive:', err.message)
  }
}

/**
 * Upload a file buffer to Google Drive.
 */
export async function uploadFileToGDrive(params: {
  buffer: Buffer
  fileName: string
  mimeType: string
  folderId?: string
}): Promise<{ fileId: string; webViewLink: string; webContentLink: string; directViewUrl: string }> {
  const drive = getGDriveClient()
  const parentFolder = params.folderId || process.env.GDRIVE_FOLDER_ID

  const fileStream = new Readable()
  fileStream.push(params.buffer)
  fileStream.push(null)

  const res = await drive.files.create({
    requestBody: {
      name: params.fileName,
      parents: parentFolder ? [parentFolder] : undefined,
    },
    media: {
      mimeType: params.mimeType,
      body: fileStream,
    },
    supportsAllDrives: true,
    fields: 'id, webViewLink, webContentLink',
  })

  const fileId = res.data.id!

  try {
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })
  } catch (err: any) {
    console.error('[GDRIVE] Failed to set public permission:', err.message)
  }

  const directViewUrl = `https://drive.google.com/uc?id=${fileId}&export=view`
  const webViewLink = res.data.webViewLink || directViewUrl
  const webContentLink = res.data.webContentLink || directViewUrl

  return {
    fileId,
    webViewLink,
    webContentLink,
    directViewUrl,
  }
}

/**
 * Delete a single file from Google Drive
 */
export async function deleteFileFromGDrive(fileId: string): Promise<void> {
  try {
    const drive = getGDriveClient()
    await drive.files.delete({ fileId, supportsAllDrives: true })
  } catch (err: any) {
    console.error('[GDRIVE] Failed to delete file:', err.message)
  }
}
