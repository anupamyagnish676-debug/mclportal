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

drive.files.delete({ fileId: '1n_M7GHGWFtvlSJ7ly4XsVEj9fAOcNzFQ' })
  .then(() => console.log('✅ Test file cleaned up.'))
  .catch(err => console.log('Cleanup notice:', err.message));
