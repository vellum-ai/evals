/**
 * Dependency-free PNG writer and 5x7 bitmap font, used by the
 * image-extraction fixture generator.
 *
 * The harness ships no imaging dependency and the fixtures are committed,
 * so the drawing surface has to be small, deterministic, and readable
 * from source. Everything here is plain arithmetic over an RGB byte
 * buffer plus the PNG container format (IHDR / IDAT / IEND, filter type
 * 0 on every row).
 *
 * Determinism: the same drawing calls produce the same pixels on every
 * machine. The compressed bytes depend on the platform's zlib, so the
 * fixture guard compares DECODED PIXELS ({@link decodePng}) rather than
 * file bytes.
 */
import { deflateSync, inflateSync } from "node:zlib";

/** An 8-bit-per-channel color. */
export type Rgb = readonly [number, number, number];

export interface Canvas {
  readonly width: number;
  readonly height: number;
  /** RGB triples, row-major, `width * height * 3` bytes. */
  readonly pixels: Uint8Array;
}

/** Glyph cell: 5 columns, 7 rows, 1 column of tracking on the right. */
export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;
const GLYPH_ADVANCE = GLYPH_WIDTH + 1;

/**
 * The font. Each glyph is 7 rows of 5 cells, `#` for ink and `.` for
 * paper. Written out rather than loaded from a font file so the fixture
 * bytes depend on nothing but this repository.
 */
const GLYPHS: Record<string, string> = {
  " ": ".....|.....|.....|.....|.....|.....|.....",
  "0": ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
  "1": "..#..|.##..|..#..|..#..|..#..|..#..|.###.",
  "2": ".###.|#...#|....#|...#.|..#..|.#...|#####",
  "3": "#####|...#.|..#..|...#.|....#|#...#|.###.",
  "4": "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
  "5": "#####|#....|####.|....#|....#|#...#|.###.",
  "6": "..##.|.#...|#....|####.|#...#|#...#|.###.",
  "7": "#####|....#|...#.|..#..|.#...|.#...|.#...",
  "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
  "9": ".###.|#...#|#...#|.####|....#|...#.|.##..",
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#",
  B: "####.|#...#|#...#|####.|#...#|#...#|####.",
  C: ".###.|#...#|#....|#....|#....|#...#|.###.",
  D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
  E: "#####|#....|#....|####.|#....|#....|#####",
  F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".###.|#...#|#....|#.###|#...#|#...#|.###.",
  H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
  I: ".###.|..#..|..#..|..#..|..#..|..#..|.###.",
  J: "..###|...#.|...#.|...#.|...#.|#..#.|.##..",
  K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
  L: "#....|#....|#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
  N: "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
  O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
  P: "####.|#...#|#...#|####.|#....|#....|#....",
  Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
  R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
  S: ".####|#....|#....|.###.|....#|....#|####.",
  T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
  U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
  V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
  W: "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#",
  X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
  Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
  Z: "#####|....#|...#.|..#..|.#...|#....|#####",
  a: ".....|.....|.###.|....#|.####|#...#|.####",
  b: "#....|#....|####.|#...#|#...#|#...#|####.",
  c: ".....|.....|.###.|#...#|#....|#...#|.###.",
  d: "....#|....#|.####|#...#|#...#|#...#|.####",
  e: ".....|.....|.###.|#...#|#####|#....|.###.",
  f: "..##.|.#..#|.#...|###..|.#...|.#...|.#...",
  g: ".....|.....|.####|#...#|.####|....#|####.",
  h: "#....|#....|####.|#...#|#...#|#...#|#...#",
  i: "..#..|.....|.##..|..#..|..#..|..#..|.###.",
  j: "...#.|.....|..##.|...#.|...#.|#..#.|.##..",
  k: "#....|#....|#..#.|#.#..|##...|#.#..|#..#.",
  l: ".##..|..#..|..#..|..#..|..#..|..#..|.###.",
  m: ".....|.....|##.#.|#.#.#|#.#.#|#...#|#...#",
  n: ".....|.....|####.|#...#|#...#|#...#|#...#",
  o: ".....|.....|.###.|#...#|#...#|#...#|.###.",
  p: ".....|.....|####.|#...#|####.|#....|#....",
  q: ".....|.....|.####|#...#|.####|....#|....#",
  r: ".....|.....|#.##.|##..#|#....|#....|#....",
  s: ".....|.....|.####|#....|.###.|....#|####.",
  t: ".#...|.#...|###..|.#...|.#...|.#..#|..##.",
  u: ".....|.....|#...#|#...#|#...#|#..##|.##.#",
  v: ".....|.....|#...#|#...#|#...#|.#.#.|..#..",
  w: ".....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.",
  x: ".....|.....|#...#|.#.#.|..#..|.#.#.|#...#",
  y: ".....|.....|#...#|#...#|.####|....#|.###.",
  z: ".....|.....|#####|...#.|..#..|.#...|#####",
  ".": ".....|.....|.....|.....|.....|.##..|.##..",
  ",": ".....|.....|.....|.....|.##..|.##..|.#...",
  ":": ".....|.##..|.##..|.....|.##..|.##..|.....",
  ";": ".....|.##..|.##..|.....|.##..|.#...|#....",
  "-": ".....|.....|.....|#####|.....|.....|.....",
  "+": ".....|..#..|..#..|#####|..#..|..#..|.....",
  "/": "....#|....#|...#.|..#..|.#...|#....|#....",
  "(": "...#.|..#..|.#...|.#...|.#...|..#..|...#.",
  ")": ".#...|..#..|...#.|...#.|...#.|..#..|.#...",
  "[": ".###.|.#...|.#...|.#...|.#...|.#...|.###.",
  "]": ".###.|...#.|...#.|...#.|...#.|...#.|.###.",
  $: "..#..|.####|#.#..|.###.|..#.#|####.|..#..",
  "%": "##..#|##.#.|...#.|..#..|.#...|.#.##|#..##",
  "@": ".###.|#...#|#.###|#.#.#|#.###|#....|.###.",
  "#": ".#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.",
  "&": ".##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#",
  "'": "..#..|..#..|.....|.....|.....|.....|.....",
  '"': ".#.#.|.#.#.|.....|.....|.....|.....|.....",
  "?": ".###.|#...#|....#|...#.|..#..|.....|..#..",
  "!": "..#..|..#..|..#..|..#..|..#..|.....|..#..",
  "=": ".....|.....|#####|.....|#####|.....|.....",
  _: ".....|.....|.....|.....|.....|.....|#####",
  "*": ".....|#.#.#|.###.|#####|.###.|#.#.#|.....",
  "<": "...#.|..#..|.#...|#....|.#...|..#..|...#.",
  ">": ".#...|..#..|...#.|....#|...#.|..#..|.#...",
};

export function createCanvas(
  width: number,
  height: number,
  background: Rgb,
): Canvas {
  const pixels = new Uint8Array(width * height * 3);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 3] = background[0];
    pixels[index * 3 + 1] = background[1];
    pixels[index * 3 + 2] = background[2];
  }
  return { width, height, pixels };
}

/** Paint one pixel. Out-of-bounds coordinates are dropped, not clamped. */
export function setPixel(
  canvas: Canvas,
  x: number,
  y: number,
  color: Rgb,
): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) {
    return;
  }
  const offset = (py * canvas.width + px) * 3;
  canvas.pixels[offset] = color[0];
  canvas.pixels[offset + 1] = color[1];
  canvas.pixels[offset + 2] = color[2];
}

export function fillRect(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Rgb,
): void {
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      setPixel(canvas, x + column, y + row, color);
    }
  }
}

/** A hollow rectangle drawn `thickness` pixels inside its bounds. */
export function strokeRect(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Rgb,
  thickness = 1,
): void {
  fillRect(canvas, x, y, width, thickness, color);
  fillRect(canvas, x, y + height - thickness, width, thickness, color);
  fillRect(canvas, x, y, thickness, height, color);
  fillRect(canvas, x + width - thickness, y, thickness, height, color);
}

/** A filled circle centred on (`cx`, `cy`). */
export function fillDisc(
  canvas: Canvas,
  cx: number,
  cy: number,
  radius: number,
  color: Rgb,
): void {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

/** A filled triangle, scanned row by row between its edges. */
export function fillTriangle(
  canvas: Canvas,
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  color: Rgb,
): void {
  const minY = Math.floor(Math.min(a[1], b[1], c[1]));
  const maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
  const minX = Math.floor(Math.min(a[0], b[0], c[0]));
  const maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
  const area = (
    p: readonly [number, number],
    q: readonly [number, number],
    x: number,
    y: number,
  ) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w0 = area(a, b, x, y);
      const w1 = area(b, c, x, y);
      const w2 = area(c, a, x, y);
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

/**
 * Fill a horizontal band with a top-to-bottom linear blend. Each row is
 * a single flat color, which is both what a photographed sky looks like
 * at this resolution and what deflate compresses best.
 */
export function fillVerticalGradient(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  from: Rgb,
  to: Rgb,
): void {
  for (let row = 0; row < height; row += 1) {
    const t = height === 1 ? 0 : row / (height - 1);
    const color: Rgb = [
      Math.round(from[0] + (to[0] - from[0]) * t),
      Math.round(from[1] + (to[1] - from[1]) * t),
      Math.round(from[2] + (to[2] - from[2]) * t),
    ];
    fillRect(canvas, x, y + row, width, 1, color);
  }
}

/** Rendered width of `text` at `scale`, tracking included. */
export function textWidth(text: string, scale: number): number {
  return text.length === 0 ? 0 : text.length * GLYPH_ADVANCE * scale - scale;
}

/** Rendered height of one line at `scale`. */
export function textHeight(scale: number): number {
  return GLYPH_HEIGHT * scale;
}

/**
 * Draw `text` with its top-left corner at (`x`, `y`), each font pixel
 * painted as a `scale` x `scale` block.
 *
 * Throws on a character the font has no glyph for: a fixture that
 * silently dropped a character would put the committed ground truth and
 * the image out of step, which is the one failure this whole module
 * exists to prevent.
 */
export function drawText(
  canvas: Canvas,
  x: number,
  y: number,
  text: string,
  color: Rgb,
  scale: number,
): void {
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const glyph = GLYPHS[character];
    if (glyph === undefined) {
      throw new Error(
        `The fixture font has no glyph for ${JSON.stringify(character)}`,
      );
    }
    const rows = glyph.split("|");
    const originX = x + index * GLYPH_ADVANCE * scale;
    for (let row = 0; row < rows.length; row += 1) {
      for (let column = 0; column < rows[row].length; column += 1) {
        if (rows[row][column] !== "#") continue;
        fillRect(
          canvas,
          originX + column * scale,
          y + row * scale,
          scale,
          scale,
          color,
        );
      }
    }
  }
}

/** Draw `text` ending at `x` (right-aligned), useful for money columns. */
export function drawTextRight(
  canvas: Canvas,
  x: number,
  y: number,
  text: string,
  color: Rgb,
  scale: number,
): void {
  drawText(canvas, x - textWidth(text, scale), y, text, color, scale);
}

/** Draw `text` centred on `x`. */
export function drawTextCentered(
  canvas: Canvas,
  x: number,
  y: number,
  text: string,
  color: Rgb,
  scale: number,
): void {
  drawText(
    canvas,
    Math.round(x - textWidth(text, scale) / 2),
    y,
    text,
    color,
    scale,
  );
}

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from(
    Array.from(type, (character) => character.charCodeAt(0)),
  );
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(body.length + 8);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(out.length - 4, crc32(body));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Scanlines with a leading filter byte (type 0, "None") per row. */
function rawScanlines(canvas: Canvas): Uint8Array {
  const stride = canvas.width * 3;
  const raw = new Uint8Array((stride + 1) * canvas.height);
  for (let row = 0; row < canvas.height; row += 1) {
    raw[row * (stride + 1)] = 0;
    raw.set(
      canvas.pixels.subarray(row * stride, (row + 1) * stride),
      row * (stride + 1) + 1,
    );
  }
  return raw;
}

/** Encode `canvas` as an 8-bit RGB PNG. */
export function encodePng(canvas: Canvas): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, canvas.width);
  view.setUint32(4, canvas.height);
  header[8] = 8; // bit depth
  header[9] = 2; // color type: truecolor RGB
  header[10] = 0; // compression: deflate
  header[11] = 0; // filter method: adaptive
  header[12] = 0; // interlace: none
  return concat([
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk(
      "IDAT",
      new Uint8Array(deflateSync(rawScanlines(canvas), { level: 9 })),
    ),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/**
 * Decode a PNG this module wrote, back to a {@link Canvas}. Supports
 * exactly the subset {@link encodePng} produces (8-bit RGB, filter type
 * 0 on every row) and throws on anything else. The fixture guard uses it
 * to compare a committed file against a fresh render on pixels rather
 * than on compressed bytes, which differ between zlib builds.
 */
export function decodePng(bytes: Uint8Array): Canvas {
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      throw new Error("Not a PNG: bad signature");
    }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  const idatParts: Uint8Array[] = [];
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      if (data[8] !== 8 || data[9] !== 2 || data[12] !== 0) {
        throw new Error("Unsupported PNG: expected 8-bit RGB, non-interlaced");
      }
    } else if (type === "IDAT") {
      idatParts.push(new Uint8Array(data));
    }
    offset += length + 12;
  }
  const raw = new Uint8Array(inflateSync(concat(idatParts)));
  const stride = width * 3;
  const pixels = new Uint8Array(stride * height);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    if (filter !== 0) {
      throw new Error(`Unsupported PNG row filter ${filter}`);
    }
    pixels.set(
      raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1)),
      row * stride,
    );
  }
  return { width, height, pixels };
}
