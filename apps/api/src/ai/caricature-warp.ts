import sharp from 'sharp';
import { FaceBox, FaceDetector } from './face-detector';

// Local caricature exaggeration (no paid model): the classic "big head, big eyes" look, made
// with smooth bulge warps around the detected face. The eyes are not detected; they sit at a
// stable place inside the detector's box (about 40% down, 30% / 70% across).

interface Bulge {
  cx: number;
  cy: number;
  radius: number;
  // Magnification at the centre is 1 / (1 - strength); none at the radius and beyond.
  strength: number;
  // Higher = magnification stays even across more of the disc, then drops in a narrower rim
  // (the head grows as a whole instead of only its centre ballooning).
  flatness: number;
}

const HEAD = { strength: 0.4, flatness: 3, radiusScale: 1.05, liftScale: 0.12 };
const EYES = { strength: 0.3, flatness: 2, radiusScale: 0.16, yScale: 0.42, xOffsets: [0.3, 0.7] };
// Kiosk selfies are close-ups: the subject is first shrunk (anchored at the bottom) so the
// enlarged head has room to grow over a smaller body.
const ZOOM_OUT = 0.78;

// Where an output pixel at distance r from the centre reads its source pixel.
function sourceDistance(r: number, bulge: Bulge): number {
  if (r >= bulge.radius) return r;
  const u = r / bulge.radius;
  return r * (1 - bulge.strength * (1 - u ** bulge.flatness));
}

// Forward mapping (source point -> output point), by bisection: sourceDistance is
// increasing in r for any strength < 1.
function outputPoint(x: number, y: number, bulge: Bulge): [number, number] {
  const dx = x - bulge.cx;
  const dy = y - bulge.cy;
  const r = Math.hypot(dx, dy);
  if (r === 0 || r >= bulge.radius) return [x, y];
  let lo = 0;
  let hi = bulge.radius;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (sourceDistance(mid, bulge) < r) lo = mid;
    else hi = mid;
  }
  const scale = (lo + hi) / 2 / r;
  return [bulge.cx + dx * scale, bulge.cy + dy * scale];
}

function inverse(x: number, y: number, bulge: Bulge): [number, number] {
  const dx = x - bulge.cx;
  const dy = y - bulge.cy;
  const r = Math.hypot(dx, dy);
  if (r === 0 || r >= bulge.radius) return [x, y];
  const scale = sourceDistance(r, bulge) / r;
  return [bulge.cx + dx * scale, bulge.cy + dy * scale];
}

export function caricatureBulges(face: FaceBox, size: number): { head: Bulge; eyes: Bulge[] } {
  const w = face.width * size;
  const h = face.height * size;
  const head: Bulge = {
    cx: (face.x + face.width / 2) * size,
    // Lifted towards the forehead so the hair grows with the face, not the neck.
    cy: (face.y + face.height / 2) * size - h * HEAD.liftScale,
    radius: Math.max(w, h) * HEAD.radiusScale,
    strength: HEAD.strength,
    flatness: HEAD.flatness,
  };
  // The eyes are bulged in the head-warped image, so their centres are moved forward first.
  const eyes = EYES.xOffsets.map((offset) => {
    const [cx, cy] = outputPoint(face.x * size + w * offset, face.y * size + h * EYES.yScale, head);
    return { cx, cy, radius: w * EYES.radiusScale * (1 / (1 - HEAD.strength)), strength: EYES.strength, flatness: EYES.flatness };
  });
  return { head, eyes };
}

// Bilinear remap of a square RGB image: each output pixel undoes the eye bulges, then the
// head bulge, and samples the source there (edges clamp).
export function warpCaricature(pixels: Buffer, size: number, face: FaceBox): Buffer {
  const { head, eyes } = caricatureBulges(face, size);
  const out = Buffer.alloc(pixels.length);
  const max = size - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sx = x;
      let sy = y;
      for (const eye of eyes) [sx, sy] = inverse(sx, sy, eye);
      [sx, sy] = inverse(sx, sy, head);
      sx = Math.min(max, Math.max(0, sx));
      sy = Math.min(max, Math.max(0, sy));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(max, x0 + 1);
      const y1 = Math.min(max, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const o = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) {
        const top = pixels[(y0 * size + x0) * 3 + c] * (1 - fx) + pixels[(y0 * size + x1) * 3 + c] * fx;
        const bottom = pixels[(y1 * size + x0) * 3 + c] * (1 - fx) + pixels[(y1 * size + x1) * 3 + c] * fx;
        out[o + c] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return out;
}

const SIZE = 1024;

// Shared by the local providers for the "caricature" preset: the warped photo is then
// styled (AnimeGAN paint or mock retouch). Returns the square photo unchanged without a face.
export class CaricatureWarper {
  constructor(private readonly detector: FaceDetector) {}

  async warp(selfie: Buffer): Promise<{ image: Buffer; warped: boolean }> {
    const inner = Math.round(SIZE * ZOOM_OUT);
    const side = Math.floor((SIZE - inner) / 2);
    const shrunk = await sharp(selfie).rotate().resize(inner, inner, { fit: 'cover' }).removeAlpha().toBuffer();
    // The margin takes the colour of the top of the picture: the plain studio background
    // left by background removal (or, without it, roughly the photo's own backdrop).
    const strip = await sharp(shrunk).extract({ left: 0, top: 0, width: inner, height: 8 }).raw().toBuffer();
    const sum = [0, 0, 0];
    for (let i = 0; i < strip.length; i++) sum[i % 3] += strip[i];
    const [r, g, b] = sum.map((total) => Math.round(total / (strip.length / 3)));
    const square = await sharp(shrunk)
      .extend({ top: SIZE - inner, left: side, right: SIZE - inner - side, bottom: 0, background: { r, g, b } })
      .raw()
      .toBuffer();
    const toJpeg = (raw: Buffer) =>
      sharp(raw, { raw: { width: SIZE, height: SIZE, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();

    const face = await this.detector.detect(await toJpeg(square));
    // No face: the original framing, not the zoomed-out one, is the better portrait.
    if (!face) {
      const image = await sharp(selfie).rotate().resize(SIZE, SIZE, { fit: 'cover' }).jpeg({ quality: 95 }).toBuffer();
      return { image, warped: false };
    }
    return { image: await toJpeg(warpCaricature(square, SIZE, face)), warped: true };
  }
}
