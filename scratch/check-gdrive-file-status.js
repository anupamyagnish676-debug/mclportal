const fs = require('fs');
const { google } = require('googleapis');

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

async function checkFileStatus() {
  const fileIds = [
    { type: 'aadhaar', id: '1hNmZ_iUf3i5lIsNasFEUeJzBJwg9DyMY' },
    { type: 'photo', id: '1TIpHapo6H9pFlZ8uAifF3bb9m4d0emgp' },
    { type: 'affidavit', id: '18lIBW3wbn9IHOWnJlhbvvxJzNF8t4sn0' },
  ];

  for (const item of fileIds) {
    try {
      const res = await drive.files.get({
        fileId: item.id,
        supportsAllDrives: true,
        fields: 'id, name, trashed, explicitlyTrashed, owners, parents',
      });
      console.log(`\n📄 [${item.type.toUpperCase()}] File ID: ${item.id}`);
      console.log(`   Name: ${res.data.name}`);
      console.log(`   Is Trashed: ${res.data.trashed}`);
      console.log(`   Explicitly Trashed: ${res.data.explicitlyTrashed}`);
      console.log(`   Owners:`, res.data.owners?.map(o => o.emailAddress));
      console.log(`   Parents:`, res.data.parents);
    } catch (err) {
      console.log(`\n❌ [${item.type.toUpperCase()}] File ID: ${item.id} -> Error: ${err.message}`);
    }
  }
}

checkFileStatus();
