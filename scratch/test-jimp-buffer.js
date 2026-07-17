const { Jimp } = require('jimp');

async function run() {
  const image = new Jimp({ width: 10, height: 10 });
  const buf = image.getBuffer('image/png');
  console.log("buf type:", typeof buf, buf instanceof Promise ? "Promise" : "Sync Buffer");
  const resolved = await buf;
  console.log("resolved buffer length:", resolved.length);
}

run().catch(console.error);
