import { google } from 'googleapis'
import { Readable } from 'stream'

export function isGDriveConfigured(): boolean {
  return (
    process.env.USE_GDRIVE_STORAGE === 'true' &&
    Boolean(process.env.GDRIVE_CLIENT_EMAIL) &&
    Boolean(process.env.GDRIVE_PRIVATE_KEY) &&
    Boolean(process.env.GDRIVE_FOLDER_ID)
  )
}

function getGDriveClient() {
  const clientEmail = process.env.GDRIVE_CLIENT_EMAIL
  let privateKey = process.env.GDRIVE_PRIVATE_KEY
  if (privateKey) {
    // Handle escaped newlines from environment variables
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
 * Makes the file readable via link and returns fileId and view links.
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

  // 1. Create file in Drive
  const res = await drive.files.create({
    requestBody: {
      name: params.fileName,
      parents: parentFolder ? [parentFolder] : undefined,
    },
    media: {
      mimeType: params.mimeType,
      body: fileStream,
    },
    fields: 'id, webViewLink, webContentLink',
  })

  const fileId = res.data.id!

  // 2. Make file readable by anyone with the link
  try {
    await drive.permissions.create({
      fileId,
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
    await drive.files.delete({ fileId })
  } catch (err: any) {
    console.error('[GDRIVE] Failed to delete file:', err.message)
  }
}
