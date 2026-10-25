// Genera los iconos PNG de la PWA sin dependencias externas.
// Dibujo: fondo degradado índigo, burbuja de diálogo blanca y una flecha ascendente.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const SS = 3; // supersampling para bordes suaves
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const n = SS * SS;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const roundRect = (x, y, x0, y0, x1, y1, r) => {
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= x0 && x <= x1 && y >= y0 && y <= y1;
};

const inTriangle = (px, py, [ax, ay], [bx, by], [cx, cy]) => {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
};

const distToSegment = (px, py, ax, ay, bx, by) => {
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
};

/** scale < 1 deja margen de seguridad (iconos maskable). */
function draw(scale, rounded) {
  return (u, v) => {
    // Fondo
    const bgInside = rounded ? roundRect(u, v, 0, 0, 1, 1, 0.22) : true;
    if (!bgInside) return [0, 0, 0, 0];
    const t = (u + v) / 2;
    const bg = [Math.round(79 + (124 - 79) * t), Math.round(70 + (58 - 70) * t), Math.round(229 + (237 - 229) * t), 1];
    // Coordenadas del dibujo centradas y escaladas
    const x = 0.5 + (u - 0.5) / scale;
    const y = 0.5 + (v - 0.5) / scale;
    const bubble = roundRect(x, y, 0.2, 0.22, 0.8, 0.66, 0.12) || inTriangle(x, y, [0.3, 0.62], [0.46, 0.62], [0.28, 0.8]);
    if (!bubble) return bg;
    // Flecha ascendente dentro de la burbuja
    const w = 0.035;
    const line =
      distToSegment(x, y, 0.32, 0.54, 0.44, 0.42) < w ||
      distToSegment(x, y, 0.44, 0.42, 0.52, 0.49) < w ||
      distToSegment(x, y, 0.52, 0.49, 0.67, 0.34) < w ||
      inTriangle(x, y, [0.7, 0.3], [0.58, 0.32], [0.68, 0.43]);
    if (line) return [79, 70, 229, 1];
    return [255, 255, 255, 1];
  };
}

writeFileSync(new URL('icon-192.png', OUT), png(192, draw(1, true)));
writeFileSync(new URL('icon-512.png', OUT), png(512, draw(1, true)));
writeFileSync(new URL('maskable-512.png', OUT), png(512, draw(0.72, false)));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>
<rect width="100" height="100" rx="22" fill="url(#g)"/>
<path d="M32 22h36a12 12 0 0 1 12 12v20a12 12 0 0 1-12 12H46L28 80l2-14a12 12 0 0 1-10-12V34a12 12 0 0 1 12-12z" fill="#fff"/>
<path d="M32 54l12-12 8 7 15-15" fill="none" stroke="#4f46e5" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M70 30l-12 2 10 11z" fill="#4f46e5"/>
</svg>`;
writeFileSync(new URL('icon.svg', OUT), svg);
console.log('Iconos generados en public/icons');
