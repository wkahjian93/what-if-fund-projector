// Draws the app icon (navy square, three rising curves for X%, Y% and "your" return) into docs/icons.
const zlib = require('zlib'), fs = require('fs');
function png(N, px) {
  const raw = Buffer.alloc((N * 4 + 1) * N);
  for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; for (let x = 0; x < N; x++) { const c = px(x, y); c.forEach((v, i) => raw[y * (N * 4 + 1) + 1 + x * 4 + i] = v); } }
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(N, 0); ih.writeUInt32BE(N, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const navy = [20, 33, 61], gold = [242, 196, 107], blue = [110, 150, 210], grey = [140, 150, 170];
function draw(N) {
  const curves = [[grey, 0.30, 0.9], [blue, 0.48, 1.4], [gold, 0.70, 2.4]];
  return png(N, (X, Y) => {
    let col = navy, a = 255;
    const u = X / N, v = Y / N;
    for (const [c, h, k] of curves) {
      // curve from bottom-left rising: y = 0.8 - h * (u-0.15)^k/(0.7^k)
      if (u < 0.15 || u > 0.85) continue;
      const t = (u - 0.15) / 0.7, cy = 0.8 - h * Math.pow(t, k) - 0.02;
      const d = Math.abs(v - cy) * N;
      const w = c === gold ? N * 0.045 : N * 0.03;
      if (d < w) { const m = Math.min(1, w - d); col = col.map((q, i) => Math.round(q * (1 - m) + c[i] * m)); }
    }
    // gold dot at end
    const dx = (u - 0.85) * N, dy = (v - (0.8 - 0.70 - 0.02)) * N, r = N * 0.07;
    if (dx * dx + dy * dy < r * r) col = gold;
    return [...col, a];
  });
}
for (const [n, f] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) fs.writeFileSync('docs/icons/' + f, draw(n));
