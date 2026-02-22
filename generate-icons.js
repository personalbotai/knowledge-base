#!/usr/bin/env node

/**
 * Minimal PNG generator for PWA icons
 * Generates solid color PNG files without external dependencies
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Color: indigo-600 (#4f46e5)
const RGB = { r: 79, g: 70, b: 229 };

function createPNG(width, height, rgb) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);   // bit depth
  ihdrData.writeUInt8(3, 9);   // color type: indexed
  ihdrData.writeUInt8(0, 10);  // compression
  ihdrData.writeUInt8(0, 11);  // filter
  ihdrData.writeUInt8(0, 12);  // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // PLTE chunk (palette with one color)
  const plteData = Buffer.from([rgb.r, rgb.g, rgb.b]);
  const plteChunk = createChunk('PLTE', plteData);

  // IDAT chunk (image data)
  // For each row: filter byte (0) followed by width pixel indices (0)
  const rowLength = width + 1;
  const raw = Buffer.alloc(height * rowLength);
  for (let y = 0; y < height; y++) {
    raw[y * rowLength] = 0; // filter type None
    raw.fill(0, y * rowLength + 1, (y + 1) * rowLength); // all pixels index 0
  }

  const compressed = zlib.deflateSync(raw);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, plteChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC-32 implementation (IEEE 802.3)
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];

  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const outDir = __dirname;
const sizes = [192, 512];

sizes.forEach(size => {
  const png = createPNG(size, size, RGB);
  const filename = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Generated ${filename} (${size}x${size})`);
});

console.log('✅ Icons generated!');
