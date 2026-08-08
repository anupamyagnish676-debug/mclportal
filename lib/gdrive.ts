import { google } from 'googleapis'
import { Readable } from 'stream'

export function isGDriveConfigured(): boolean {
  if (process.env.USE_GDRIVE_STORAGE !== 'true') return false

  // Method 1: OAuth2 (User Account - Works on Personal @gmail.com)
  const hasOAuth = Boolean(
    process.env.GDRIVE_CLIENT_ID &&
    process.env.GDRIVE_CLIENT_SECRET &&
    process.env.GDRIVE_REFRESH_TOKEN &&
    process.env.GDRIVE_FOLDER_ID
  )

  // Method 2: Service Account (Works on Shared Drives / Google Workspace)
  const hasServiceAccount = Boolean(
    process.env.GDRIVE_CLIENT_EMAIL &&
    process.env.GDRIVE_PRIVATE_KEY &&
    process.env.GDRIVE_FOLDER_ID
  )

  return hasOAuth || hasServiceAccount
}

function getGDriveClient() {
  // Prefer OAuth2 if configured (solves Service Account quota limits)
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

  // Fallback to Service Account JWT
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
 * Upload a file buffer to Google Drive.
 * Supports both Shared Drives and Personal Drives.
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

  // 1. Create file in Drive (with supportsAllDrives for Shared Drives)
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

  // 2. Make file readable by anyone with the link
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
 * Delete a file from Google Drive
 */
export async function deleteFileFromGDrive(fileId: string): Promise<void> {
  try {
    const drive = getGDriveClient()
    await drive.files.delete({ fileId, supportsAllDrives: true })
  } catch (err: any) {
    console.error('[GDRIVE] Failed to delete file:', err.message)
  }
}
