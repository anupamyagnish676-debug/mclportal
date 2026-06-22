const fs = require('fs');
const https = require('https');
const urlModule = require('url');

const logoUrl = 'https://upload.wikimedia.org/wikipedia/en/b/b3/Coal_India_Logo.png';
const outputPath = 'public/coal-india-logo.png';

function download(urlStr) {
  console.log('Downloading from:', urlStr);
  
  const parsedUrl = urlModule.parse(urlStr);
  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.path,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  https.get(options, (response) => {
    if (response.statusCode === 301 || response.statusCode === 302) {
      let redirectUrl = response.headers.location;
      if (!redirectUrl.startsWith('http')) {
        // Handle relative redirect
        redirectUrl = parsedUrl.protocol + '//' + parsedUrl.host + redirectUrl;
      }
      download(redirectUrl);
      return;
    }
    
    if (response.statusCode !== 200) {
      console.error(`Failed to download. Status: ${response.statusCode}`);
      return;
    }
    
    const file = fs.createWriteStream(outputPath);
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Coal India logo downloaded successfully to public/coal-india-logo.png');
    });
  }).on('error', (err) => {
    console.error('Error:', err.message);
  });
}

download(logoUrl);
