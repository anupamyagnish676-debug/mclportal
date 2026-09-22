const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { Readable } = require('stream');

// Load environment variables
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) {
    envVars[key.trim()] = val.join('=').trim().replace(/^"|"$/g, '');
  }
});
Object.assign(process.env, envVars);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getGDriveClient() {
  if (
    process.env.GDRIVE_CLIENT_ID &&
    process.env.GDRIVE_CLIENT_SECRET &&
    process.env.GDRIVE_REFRESH_TOKEN
  ) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GDRIVE_CLIENT_ID,
      process.env.GDRIVE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GDRIVE_REFRESH_TOKEN,
    });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  const clientEmail = process.env.GDRIVE_CLIENT_EMAIL;
  let privateKey = process.env.GDRIVE_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

async function runTest() {
  console.log('--- 1. Fetching Talcher Area from Database ---');
  const { data: area, error: areaError } = await supabase
    .from('areas')
    .select('name, gdrive_folder_id, owner_email')
    .eq('name', 'Talcher')
    .maybeSingle();

  if (areaError) {
    console.error('Database query error:', areaError);
    return;
  }

  console.log('Talcher DB Record:', area);

  const targetFolderId = area?.gdrive_folder_id || process.env.GDRIVE_FOLDER_ID;
  const targetOwnerEmail = area?.owner_email || 'anupamyagnish676@gmail.com';

  console.log(`\nUsing Target Folder ID: ${targetFolderId}`);
  console.log(`Using Target Owner Email: ${targetOwnerEmail}`);

  console.log('\n--- 2. Connecting to Google Drive API ---');
  const drive = getGDriveClient();

  const sampleBuffer = Buffer.from('Automated test for Talcher decentralized ownership transfer.', 'utf8');
  const testFileName = `test_transfer_${Date.now()}.txt`;

  const fileStream = new Readable();
  fileStream.push(sampleBuffer);
  fileStream.push(null);

  console.log('Creating file in Google Drive folder...');
  const res = await drive.files.create({
    requestBody: {
      name: testFileName,
      parents: targetFolderId ? [targetFolderId] : undefined,
    },
    media: {
      mimeType: 'text/plain',
      body: fileStream,
    },
    supportsAllDrives: true,
    fields: 'id, name, webViewLink, owners',
  });

  const fileId = res.data.id;
  console.log(`✅ File Created Successfully! File ID: ${fileId}`);
  console.log('Initial File Owner:', res.data.owners);

  console.log('\n--- 3. Testing Ownership Transfer to ' + targetOwnerEmail + ' ---');
  try {
    const permRes = await drive.permissions.create({
      fileId,
      transferOwnership: true,
      supportsAllDrives: true,
      requestBody: {
        role: 'owner',
        type: 'user',
        emailAddress: targetOwnerEmail,
      },
      fields: 'id, role, type, emailAddress',
    });
    console.log('✅ Ownership Transfer Response:', permRes.data);

    // Verify who the new owner is
    const verifyRes = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: 'id, name, owners',
    });
    console.log('🎉 Verified New Owner in Google Drive:', verifyRes.data.owners);
  } catch (permErr) {
    console.error('⚠️ Note during ownership transfer:', permErr.message || permErr);
  }

  console.log('\n--- Test Completed Successfully ---');
}

runTest();
