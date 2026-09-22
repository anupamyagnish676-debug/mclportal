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

async function checkFolder() {
  const res = await drive.files.get({
    fileId: '1p9To8-5JQemT6oq2Tt86AA3yqZe_gLV0',
    supportsAllDrives: true,
    fields: 'id, name, parents, owners, trashed',
  });
  console.log('Folder Info:', res.data);

  if (res.data.parents) {
    const parentRes = await drive.files.get({
      fileId: res.data.parents[0],
      supportsAllDrives: true,
      fields: 'id, name, parents, owners, trashed',
    });
    console.log('Grandparent Folder Info:', parentRes.data);
  }
}

checkFolder();
