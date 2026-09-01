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
 * Helper to fetch area owner email from Supabase for ownership transfer
 */
export async function getAreaOwnerEmail(areaName?: string | null): Promise<string | undefined> {
  if (!areaName) return undefined
  try {
    const adminClient = createAdminClient()
    const { data } = await adminClient
      .from('areas')
      .select('owner_email')
      .eq('name', areaName.trim())
      .maybeSingle()

    if (data?.owner_email && data.owner_email.trim()) {
      return data.owner_email.trim()
    }
  } catch (err) {
    console.error('[GDRIVE] Error fetching area owner email from DB:', err)
  }
  return undefined
}

/**
 * Helper to fetch both Google Drive Folder ID and Area Owner Email
 */
export async function getAreaDriveInfo(areaName?: string | null): Promise<{ folderId?: string; ownerEmail?: string }> {
  if (!areaName) return { folderId: process.env.GDRIVE_FOLDER_ID }
  try {
    const adminClient = createAdminClient()
    const { data } = await adminClient
      .from('areas')
      .select('gdrive_folder_id, owner_email')
      .eq('name', areaName.trim())
      .maybeSingle()

    return {
      folderId: data?.gdrive_folder_id?.trim() || process.env.GDRIVE_FOLDER_ID,
      ownerEmail: data?.owner_email?.trim() || undefined,
    }
  } catch (err) {
    console.error('[GDRIVE] Error fetching area info from DB:', err)
    return { folderId: process.env.GDRIVE_FOLDER_ID }
  }
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
 * Find or create a dedicated LOR folder hierarchy in Google Drive.
 * Structure: Root -> LOR -> AreaName (e.g., LOR / Lingaraj)
 */
export async function getOrCreateLorAreaFolder(areaName?: string | null): Promise<string> {
  const drive = getGDriveClient()
  const parentFolder = process.env.GDRIVE_FOLDER_ID

  const rawArea = areaName && areaName.trim() ? areaName.trim() : 'Headquarters'
  const cleanArea = rawArea.replace(/[^a-zA-Z0-9\s]/g, '').trim()

  try {
    // Step 1: Find or Create Master "LOR" Folder inside parentFolder
    let lorMasterFolderId = parentFolder
    if (parentFolder) {
      const masterQuery = `'${parentFolder}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = 'LOR' and trashed = false`
      const masterSearchRes = await drive.files.list({
        q: masterQuery,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })

      if (masterSearchRes.data.files && masterSearchRes.data.files.length > 0) {
        lorMasterFolderId = masterSearchRes.data.files[0].id!
      } else {
        const masterCreateRes = await drive.files.create({
          requestBody: {
            name: 'LOR',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolder],
          },
          supportsAllDrives: true,
          fields: 'id',
        })
        lorMasterFolderId = masterCreateRes.data.id!
      }
    }

    // Step 2: Find or Create Area Subfolder inside LOR Master Folder
    if (lorMasterFolderId) {
      const areaQuery = `'${lorMasterFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${cleanArea}' and trashed = false`
      const areaSearchRes = await drive.files.list({
        q: areaQuery,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })

      if (areaSearchRes.data.files && areaSearchRes.data.files.length > 0) {
        return areaSearchRes.data.files[0].id!
      } else {
        const areaCreateRes = await drive.files.create({
          requestBody: {
            name: cleanArea,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [lorMasterFolderId],
          },
          supportsAllDrives: true,
          fields: 'id',
        })
        return areaCreateRes.data.id!
      }
    }

    return parentFolder || ''
  } catch (err: any) {
    console.error('[GDRIVE] Error in getOrCreateLorAreaFolder:', err.message)
    return parentFolder || ''
  }
}

/**
 * Find or create a dedicated Study_Materials folder inside an Area's Google Drive folder.
 * Structure: Area Drive -> Study_Materials
 */
export async function getOrCreateStudyMaterialsAreaFolder(areaName?: string | null): Promise<string> {
  const drive = getGDriveClient()
  const areaFolderId = await getAreaDriveFolderId(areaName)
  const parentFolder = areaFolderId || process.env.GDRIVE_FOLDER_ID

  try {
    if (!parentFolder) return ''

    const q = `'${parentFolder}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = 'Study_Materials' and trashed = false`
    const searchRes = await drive.files.list({
      q,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      return searchRes.data.files[0].id!
    }

    const createRes = await drive.files.create({
      requestBody: {
        name: 'Study_Materials',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolder],
      },
      supportsAllDrives: true,
      fields: 'id',
    })
    return createRes.data.id!
  } catch (err: any) {
    console.error('[GDRIVE] Error in getOrCreateStudyMaterialsAreaFolder:', err.message)
    return parentFolder || ''
  }
}

/**
 * Find or create a dedicated Signatures folder inside an Area's Google Drive folder.
 * Structure: Area Drive -> Signatures
 */
export async function getOrCreateSignaturesAreaFolder(areaName?: string | null): Promise<string> {
  const drive = getGDriveClient()
  const areaFolderId = await getAreaDriveFolderId(areaName)
  const parentFolder = areaFolderId || process.env.GDRIVE_FOLDER_ID

  try {
    if (!parentFolder) return ''

    const q = `'${parentFolder}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = 'Signatures' and trashed = false`
    const searchRes = await drive.files.list({
      q,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      return searchRes.data.files[0].id!
    }

    const createRes = await drive.files.create({
      requestBody: {
        name: 'Signatures',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolder],
      },
      supportsAllDrives: true,
      fields: 'id',
    })
    return createRes.data.id!
  } catch (err: any) {
    console.error('[GDRIVE] Error in getOrCreateSignaturesAreaFolder:', err.message)
    return parentFolder || ''
  }
}

/**
 * Find or create a dedicated Notices folder inside an Area's Google Drive folder.
 * Structure: Area Drive -> Notices
 */
export async function getOrCreateNoticesAreaFolder(areaName?: string | null): Promise<string> {
  const drive = getGDriveClient()
  const areaFolderId = await getAreaDriveFolderId(areaName)
  const parentFolder = areaFolderId || process.env.GDRIVE_FOLDER_ID

  try {
    if (!parentFolder) return ''

    const q = `'${parentFolder}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = 'Notices' and trashed = false`
    const searchRes = await drive.files.list({
      q,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      return searchRes.data.files[0].id!
    }

    const createRes = await drive.files.create({
      requestBody: {
        name: 'Notices',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolder],
      },
      supportsAllDrives: true,
      fields: 'id',
    })
    return createRes.data.id!
  } catch (err: any) {
    console.error('[GDRIVE] Error in getOrCreateNoticesAreaFolder:', err.message)
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
  area?: string | null
  ownerEmail?: string
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

  // Automatic Ownership Transfer to Area's Google/Gmail account
  const targetOwner = params.ownerEmail || (params.area ? await getAreaOwnerEmail(params.area) : undefined)
  if (targetOwner) {
    try {
      await drive.permissions.create({
        fileId,
        transferOwnership: true,
        supportsAllDrives: true,
        requestBody: {
          role: 'owner',
          type: 'user',
          emailAddress: targetOwner,
        },
      })
      console.log(`[GDRIVE] ✅ Ownership of ${params.fileName} successfully transferred to ${targetOwner}`)
    } catch (err: any) {
      console.warn(`[GDRIVE] Ownership transfer notice for ${targetOwner}:`, err.message)
    }
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

/**
 * Stream a file from Google Drive using the Drive API (server-side).
 * Returns a ReadableStream and the file's MIME type.
 * Used by the photo-proxy API to serve student photos without CORS/auth issues.
 */
export async function getGDriveFileStream(fileId: string): Promise<{ stream: ReadableStream; mimeType: string }> {
  const drive = getGDriveClient()

  // Get file metadata first (for mimeType)
  const metaRes = await drive.files.get({
    fileId,
    fields: 'mimeType',
    supportsAllDrives: true,
  })
  const mimeType = metaRes.data.mimeType || 'image/jpeg'

  // Get file content as a stream
  const mediaRes = await drive.files.get(
    {
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'stream' }
  )

  // Convert Node.js Readable to Web ReadableStream
  const nodeStream = mediaRes.data as any
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(chunk))
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (err: Error) => controller.error(err))
    },
  })

  return { stream: webStream, mimeType }
}

/**
 * Fetch raw file Buffer directly from Google Drive.
 */
export async function getGDriveFileBuffer(fileId: string): Promise<Buffer> {
  const drive = getGDriveClient()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data as ArrayBuffer)
}

/**
 * Save or Update a student's daily log entry directly inside their Google Drive folder (Daily_Logbook.json).
 */
export async function saveStudentLogbookToGDrive(params: {
  studentName: string
  studentId: string
  serialNo?: string | null
  area?: string | null
  date: string
  content: string
}): Promise<void> {
  const drive = getGDriveClient()
  const studentFolderId = await getOrCreateStudentFolder({
    studentName: params.studentName,
    studentId: params.studentId,
    serialNo: params.serialNo,
    area: params.area
  })

  const fileName = 'Daily_Logbook.json'
  const q = `'${studentFolderId}' in parents and name = '${fileName}' and trashed = false`

  let fileId: string | null = null
  let existingLogs: any[] = []

  try {
    const listRes = await drive.files.list({ q, fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true })
    if (listRes.data.files && listRes.data.files.length > 0) {
      fileId = listRes.data.files[0].id!
      const getRes = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true })
      if (typeof getRes.data === 'string') {
        try { existingLogs = JSON.parse(getRes.data) } catch (e) { existingLogs = [] }
      } else if (typeof getRes.data === 'object' && getRes.data !== null) {
        existingLogs = Array.isArray(getRes.data) ? getRes.data : []
      }
    }
  } catch (e) {
    existingLogs = []
  }

  const existingIdx = existingLogs.findIndex((item: any) => item.date === params.date)
  const updatedItem = {
    date: params.date,
    content: params.content,
    updated_at: new Date().toISOString()
  }

  if (existingIdx >= 0) {
    existingLogs[existingIdx] = updatedItem
  } else {
    existingLogs.push(updatedItem)
  }

  existingLogs.sort((a: any, b: any) => (b.date > a.date ? 1 : -1))

  const jsonBuffer = Buffer.from(JSON.stringify(existingLogs, null, 2), 'utf-8')
  const fileStream = new Readable()
  fileStream.push(jsonBuffer)
  fileStream.push(null)

  if (fileId) {
    await drive.files.update({
      fileId,
      media: { mimeType: 'application/json', body: fileStream },
      supportsAllDrives: true
    })
  } else {
    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [studentFolderId],
        mimeType: 'application/json'
      },
      media: { mimeType: 'application/json', body: fileStream },
      supportsAllDrives: true
    })
  }
}

/**
 * Fetch a student's daily logbook entries directly from their Google Drive folder (Daily_Logbook.json).
 */
export async function getStudentLogbookFromGDrive(params: {
  studentName: string
  studentId: string
  serialNo?: string | null
  area?: string | null
}): Promise<any[]> {
  try {
    const drive = getGDriveClient()
    const studentFolderId = await getOrCreateStudentFolder({
      studentName: params.studentName,
      studentId: params.studentId,
      serialNo: params.serialNo,
      area: params.area
    })

    const fileName = 'Daily_Logbook.json'
    const q = `'${studentFolderId}' in parents and name = '${fileName}' and trashed = false`

    const listRes = await drive.files.list({ q, fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true })
    if (listRes.data.files && listRes.data.files.length > 0) {
      const fileId = listRes.data.files[0].id!
      const getRes = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true })
      let logs: any[] = []
      if (typeof getRes.data === 'string') {
        logs = JSON.parse(getRes.data)
      } else if (Array.isArray(getRes.data)) {
        logs = getRes.data
      }
      return logs
    }
  } catch (err: any) {
    console.error('[GDRIVE] Error loading logbook from Drive:', err.message)
  }
  return []
}

/**
 * Find or create a dedicated Helpdesk_Tickets folder inside an Area's Google Drive folder.
 */
export async function getOrCreateHelpdeskAreaFolder(areaName?: string | null): Promise<string> {
  const drive = getGDriveClient()
  const areaFolderId = await getAreaDriveFolderId(areaName)
  const parentFolder = areaFolderId || process.env.GDRIVE_FOLDER_ID

  try {
    if (!parentFolder) return ''

    const q = `'${parentFolder}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = 'Helpdesk_Tickets' and trashed = false`
    const searchRes = await drive.files.list({
      q,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      return searchRes.data.files[0].id!
    }

    const createRes = await drive.files.create({
      requestBody: {
        name: 'Helpdesk_Tickets',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolder],
      },
      supportsAllDrives: true,
      fields: 'id',
    })
    return createRes.data.id!
  } catch (err: any) {
    console.error('[GDRIVE] Error in getOrCreateHelpdeskAreaFolder:', err.message)
    return parentFolder || ''
  }
}

/**
 * Save or update a Support Ticket directly inside Google Drive (Helpdesk_Tickets.json).
 */
export async function saveHelpdeskTicketToGDrive(ticket: {
  id: string
  studentId: string
  studentName: string
  area: string
  category: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved'
  attachmentUrl?: string | null
  resolutionNotes?: string | null
  createdAt: string
  updatedAt: string
}): Promise<void> {
  const drive = getGDriveClient()
  const folderId = await getOrCreateHelpdeskAreaFolder(ticket.area)
  if (!folderId) return

  const fileName = 'Helpdesk_Tickets.json'
  const q = `'${folderId}' in parents and name = '${fileName}' and trashed = false`

  let fileId: string | null = null
  let existingTickets: any[] = []

  try {
    const listRes = await drive.files.list({ q, fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true })
    if (listRes.data.files && listRes.data.files.length > 0) {
      fileId = listRes.data.files[0].id!
      const getRes = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true })
      if (typeof getRes.data === 'string') {
        try { existingTickets = JSON.parse(getRes.data) } catch (e) { existingTickets = [] }
      } else if (Array.isArray(getRes.data)) {
        existingTickets = getRes.data
      }
    }
  } catch (e) {
    existingTickets = []
  }

  const existingIdx = existingTickets.findIndex((t: any) => t.id === ticket.id)
  if (existingIdx >= 0) {
    existingTickets[existingIdx] = { ...existingTickets[existingIdx], ...ticket }
  } else {
    existingTickets.unshift(ticket)
  }

  const jsonBuffer = Buffer.from(JSON.stringify(existingTickets, null, 2), 'utf-8')
  const fileStream = new Readable()
  fileStream.push(jsonBuffer)
  fileStream.push(null)

  if (fileId) {
    await drive.files.update({
      fileId,
      media: { mimeType: 'application/json', body: fileStream },
      supportsAllDrives: true
    })
  } else {
    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/json'
      },
      media: { mimeType: 'application/json', body: fileStream },
      supportsAllDrives: true
    })
  }
}

/**
 * Fetch Support Tickets from Google Drive (Helpdesk_Tickets.json).
 */
export async function getHelpdeskTicketsFromGDrive(areaName: string, studentId?: string): Promise<any[]> {
  try {
    const drive = getGDriveClient()
    const folderId = await getOrCreateHelpdeskAreaFolder(areaName)
    if (!folderId) return []

    const fileName = 'Helpdesk_Tickets.json'
    const q = `'${folderId}' in parents and name = '${fileName}' and trashed = false`

    const listRes = await drive.files.list({ q, fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true })
    if (listRes.data.files && listRes.data.files.length > 0) {
      const fileId = listRes.data.files[0].id!
      const getRes = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true })
      let tickets: any[] = []
      if (typeof getRes.data === 'string') {
        tickets = JSON.parse(getRes.data)
      } else if (Array.isArray(getRes.data)) {
        tickets = getRes.data
      }
      if (studentId) {
        return tickets.filter((t: any) => t.studentId === studentId)
      }
      return tickets
    }
  } catch (err: any) {
    console.error('[GDRIVE] Error loading support tickets from Drive:', err.message)
  }
  return []
}

// Export stubs for complete backwards compatibility & Vercel build safety
export async function saveMentorMessageToGDrive(...args: any[]): Promise<void> {}
export async function getMentorMessagesFromGDrive(...args: any[]): Promise<any[]> { return [] }
