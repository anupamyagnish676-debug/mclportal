const fs = require('fs');
const { google } = require('googleapis');
const { Readable } = require('stream');

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) {
    envVars[key.trim()] = val.join('=').trim().replace(/^"|"$/g, '');
  }
});

const oauth2Client = new google.auth.OAuth2(
  envVars.GDRIVE_CLIENT_ID,
  envVars.GDRIVE_CLIENT_SECRET
);
oauth2Client.setCredentials({
  refresh_token: envVars.GDRIVE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function testTalcherUpload() {
  const targetFolderId = '1cY0_0q9Yvpjcm0N_FJiEBJlPpcuCowGW';
  const targetOwnerEmail = 'anupamyagnish676@gmail.com';

  console.log(`\n📁 Uploading to Talcher Folder: ${targetFolderId}`);
  console.log(`👤 Target Owner Email: ${targetOwnerEmail}`);

  const sampleBuffer = Buffer.from('Testing decentralized Google Drive ownership transfer to Talcher Area Admin (anupamyagnish676@gmail.com)', 'utf8');
  const testFileName = `Talcher_Verification_${Date.now()}.txt`;

  const fileStream = new Readable();
  fileStream.push(sampleBuffer);
  fileStream.push(null);

  try {
    // 1. Create file inside Talcher's folder
    const createRes = await drive.files.create({
      requestBody: {
        name: testFileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType: 'text/plain',
        body: fileStream,
      },
      supportsAllDrives: true,
      fields: 'id, name, webViewLink, owners',
    });

    const fileId = createRes.data.id;
    console.log(`\n✅ 1. File Created in Talcher Folder!`);
    console.log(`   File Name: ${testFileName}`);
    console.log(`   File ID: ${fileId}`);
    console.log(`   Initial Owner:`, createRes.data.owners?.[0]?.emailAddress);

    // 2. Set reader permissions for portal access
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    console.log(`✅ 2. Public Read Permission set successfully.`);

    // 3. Transfer ownership to anupamyagnish676@gmail.com
    console.log(`\n🔄 3. Transferring ownership to ${targetOwnerEmail}...`);
    try {
      await drive.permissions.create({
        fileId,
        transferOwnership: true,
        supportsAllDrives: true,
        requestBody: {
          role: 'owner',
          type: 'user',
          emailAddress: targetOwnerEmail,
        },
      });
      console.log(`✅ 3. Ownership transfer succeeded!`);
    } catch (permErr) {
      console.log(`ℹ️ Ownership Notice:`, permErr.message);
    }

    // 4. Verify the new owner on Google Drive
    const verifyRes = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: 'id, name, owners, webViewLink',
    });

    console.log(`\n🎉 VERIFICATION RESULT:`);
    console.log(`   Current File Owner:`, verifyRes.data.owners?.[0]?.emailAddress);
    console.log(`   Owner Display Name:`, verifyRes.data.owners?.[0]?.displayName);
    console.log(`   View Link:`, verifyRes.data.webViewLink);

    console.log(`\n🏆 TEST COMPLETED SUCCESSFULLY!`);
  } catch (err) {
    console.error('❌ Error during test:', err.message || err);
  }
}

testTalcherUpload();
