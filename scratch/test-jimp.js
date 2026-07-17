const Jimp = require('jimp');

async function run() {
  console.log("Jimp loaded successfully:", typeof Jimp);
  // Try to create a dummy image and manipulate it
  const image = new Jimp(10, 10, 0xFFFFFFFF); // solid white
  let whiteCount = 0;
  let transparentCount = 0;

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    if (r === 255 && g === 255 && b === 255) {
      whiteCount++;
      this.bitmap.data[idx + 3] = 0; // make transparent
    }
  });

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const a = this.bitmap.data[idx + 3];
    if (a === 0) {
      transparentCount++;
    }
  });

  console.log(`Original white pixels: ${whiteCount}, Transparent pixels now: ${transparentCount}`);
}

run().catch(console.error);
