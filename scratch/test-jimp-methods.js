const { Jimp } = require('jimp');

async function run() {
  const image = new Jimp({ width: 10, height: 10 });
  console.log("Image methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(image)));
  console.log("MIME types in Jimp:", Object.keys(Jimp));
}

run().catch(console.error);
