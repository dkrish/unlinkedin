// Generates minimal valid PNG files for the extension icons.
// Run once with: node scripts/generate-icons.cjs
const fs = require('fs');
const zlib = require('zlib');

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc32(crcInput))]);
}

function makePng(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk(
    'IHDR',
    Buffer.concat([uint32BE(size), uint32BE(size), Buffer.from([8, 2, 0, 0, 0])])
  );
  const row = Buffer.alloc(1 + size * 3);
  row[0] = 0; // filter: None
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const rawPixels = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = chunk('IDAT', zlib.deflateSync(rawPixels));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

fs.mkdirSync('icons', { recursive: true });

// Brand purple: #7c3aed = rgb(124, 58, 237)
const [r, g, b] = [124, 58, 237];

for (const size of [16, 32, 48, 128]) {
  const path = `icons/icon${size}.png`;
  fs.writeFileSync(path, makePng(size, r, g, b));
  console.log(`✓ ${path}`);
}
