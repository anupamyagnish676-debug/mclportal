const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../public/models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

let completed = 0;

files.forEach(file => {
  const dest = path.join(modelsDir, file);
  https.get(baseUrl + file, (res) => {
    const fileStream = fs.createWriteStream(dest);
    res.pipe(fileStream);
    fileStream.on('finish', () => {
      fileStream.close();
      completed++;
      console.log(`[${completed}/${files.length}] Downloaded ${file}`);
      if (completed === files.length) {
        console.log('✅ All AI models downloaded successfully!');
      }
    });
  }).on('error', (err) => console.error(`Error downloading ${file}:`, err));
});
