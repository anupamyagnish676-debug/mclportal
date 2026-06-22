const fs = require('fs');
const path = require('path');

function getPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  // Read width and height from PNG IHDR chunk
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

const publicDir = path.join(__dirname, '..', 'public');
const files = ['mcl-logo-transparent.png', 'coal-india-logo-transparent.png', 'gm-signature.png'];

files.forEach(file => {
  const filePath = path.join(publicDir, file);
  if (fs.existsSync(filePath)) {
    const dim = getPngDimensions(filePath);
    console.log(`${file}: ${dim.width}x${dim.height} (Aspect Ratio: ${(dim.width / dim.height).toFixed(2)})`);
  } else {
    console.log(`${file} does not exist`);
  }
});
