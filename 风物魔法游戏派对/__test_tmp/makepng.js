// 生成一张 600×400 测试 PNG（彩色条纹+对角线，便于目检是否变形）
const zlib = require('zlib');
const fs = require('fs');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const W = 600, H = 400;
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  const row = raw.slice(y * (1 + W * 3), (y + 1) * (1 + W * 3));
  row[0] = 0;
  for (let x = 0; x < W; x++) {
    const i = 1 + x * 3;
    const band = Math.floor(x / 100);
    let r = (band * 45) % 256, g = (y * 255 / H) | 0, b = 200;
    if (Math.abs(x - y * 1.5) < 4) { r = 255; g = 255; b = 255; } // 对角白线
    row[i] = r; row[i + 1] = g; row[i + 2] = b;
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8bit truecolor
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
]);
fs.writeFileSync(__dirname + '/test-upload.png', png);
console.log('written', png.length, 'bytes');
