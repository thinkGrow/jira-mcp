// Generates small, real PNG files for the mock tickets so Claude Code has
// actual images to display. No dependencies — builds PNGs with zlib.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "mock", "images");
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// draw(x, y) -> [r, g, b]
function makePng(width, height, draw) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = draw(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const W = 480;
const H = 260;
const border = (x, y) => x < 3 || y < 3 || x >= W - 3 || y >= H - 3;

// 1) A "login screen" mockup: light panel with a misaligned button (shifted right).
const login = makePng(W, H, (x, y) => {
  if (border(x, y)) return [90, 100, 120];
  // header bar
  if (y < 46) return [63, 81, 181];
  // input fields (two grey rounded-ish bars)
  if (x > 60 && x < 420 && y > 90 && y < 120) return [225, 228, 235];
  if (x > 60 && x < 420 && y > 135 && y < 165) return [225, 228, 235];
  // login button — intentionally pushed to the far right (the bug)
  if (x > 300 && x < 430 && y > 195 && y < 235) return [76, 175, 80];
  return [247, 248, 250];
});
writeFileSync(path.join(outDir, "login-mobile.png"), login);

// 2) An "error trace" screenshot: dark terminal with a red 500 banner.
const error = makePng(W, H, (x, y) => {
  if (border(x, y)) return [40, 40, 40];
  // red error banner near the top
  if (y > 20 && y < 60 && x > 20 && x < W - 20) return [198, 40, 40];
  // faux log lines (lighter grey bars on dark bg)
  const line = Math.floor((y - 80) / 26);
  if (y > 80 && (y - 80) % 26 < 12 && line >= 0 && line < 6) {
    const len = [360, 300, 200, 420, 260, 180][line];
    if (x > 24 && x < 24 + len) return [150, 160, 150];
  }
  return [24, 26, 28];
});
writeFileSync(path.join(outDir, "error-trace.png"), error);

console.log(`Wrote mock images to ${outDir}`);
