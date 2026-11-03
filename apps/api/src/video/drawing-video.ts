import { spawn } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { BRUSH_WIDTH_RATIO, brushStrokes, polylineLength, truncatePolyline, type Point } from '@badgi-studio/shared';

// MP4 replay of the live drawing shown on the kiosk and the wall (apps/*/DrawnPortrait.tsx):
// the traced outline inked stroke by stroke, the colour brushed in, then the framed portrait.
// Frames are rendered with sharp and piped as raw RGB into ffmpeg (H.264, plays everywhere,
// including WhatsApp and iOS).

export const VIDEO_SIZE = 720;
const FPS = 25;
const INK_SECONDS = 5;
const COLOR_SECONDS = 4;
const FRAME_SECONDS = 1;
const HOLD_SECONDS = 2;
const TRACE_SIZE = 480; // SketchService viewBox

interface SketchPath {
  d: string;
  length: number;
}

// Length of the control polygon: never shorter than the curve, so a dash of this length
// always covers the whole path (it just finishes a little early on very curvy strokes).
function approximateLength(d: string): number {
  const numbers = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  let length = 0;
  for (let i = 2; i + 1 < numbers.length; i += 2) {
    length += Math.hypot(numbers[i] - numbers[i - 2], numbers[i + 1] - numbers[i - 1]);
  }
  return Math.max(length, 1);
}

export function parseSketch(svg: string): { paths: SketchPath[]; strokeAttributes: string } {
  const group = svg.match(/<g([^>]*)>/);
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((match) => ({
    d: match[1],
    length: approximateLength(match[1]),
  }));
  return { paths, strokeAttributes: group?.[1] ?? ' fill="none" stroke="#0E1B2C" stroke-width="2.5"' };
}

// SVG of the ink after `drawn` units of pen travel.
export function inkSvg(paths: SketchPath[], strokeAttributes: string, drawn: number): string {
  let remaining = drawn;
  const parts: string[] = [];
  for (const path of paths) {
    if (remaining <= 0) break;
    if (remaining >= path.length) {
      parts.push(`<path d="${path.d}"/>`);
    } else {
      const offset = path.length - remaining;
      parts.push(`<path d="${path.d}" stroke-dasharray="${path.length} ${path.length}" stroke-dashoffset="${offset}"/>`);
    }
    remaining -= path.length;
  }
  return (
    `<svg viewBox="0 0 ${TRACE_SIZE} ${TRACE_SIZE}" width="${VIDEO_SIZE}" height="${VIDEO_SIZE}" xmlns="http://www.w3.org/2000/svg">` +
    `<g${strokeAttributes}>${parts.join('')}</g></svg>`
  );
}

function brushMaskSvg(progress: number): string {
  const strokes = brushStrokes(VIDEO_SIZE);
  const lengths = strokes.map(polylineLength);
  const width = VIDEO_SIZE * BRUSH_WIDTH_RATIO;
  let remaining = progress * lengths.reduce((sum, l) => sum + l, 0);
  const lines: string[] = [];
  const polyline = (points: Point[], strokeWidth: number, dy: number) =>
    `<polyline points="${points.map(([x, y]) => `${x.toFixed(1)},${(y + dy).toFixed(1)}`).join(' ')}" stroke-width="${strokeWidth.toFixed(1)}"/>`;
  for (let i = 0; i < strokes.length && remaining > 0; i++) {
    const partial = truncatePolyline(strokes[i], Math.min(remaining, lengths[i]));
    if (partial.length >= 2) {
      // Main stroke plus two thinner "bristle" strokes, as in the canvas animation.
      lines.push(polyline(partial, width, 0), polyline(partial, width * 0.55, width * 0.38), polyline(partial, width * 0.55, -width * 0.38));
    }
    remaining -= lengths[i];
  }
  return (
    `<svg width="${VIDEO_SIZE}" height="${VIDEO_SIZE}" xmlns="http://www.w3.org/2000/svg">` +
    `<g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">${lines.join('')}</g></svg>`
  );
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function blend(a: Buffer, b: Buffer, t: number): Buffer {
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) out[i] = Math.round(a[i] * (1 - t) + b[i] * t);
  return out;
}

export interface DrawingVideoInput {
  sketchSvg: string;
  // Unframed result (painted in) and the final framed portrait.
  color: Buffer;
  framed: Buffer;
}

export class DrawingVideoRenderer {
  constructor(private readonly ffmpegPath: string) {}

  async render(input: DrawingVideoInput): Promise<Buffer> {
    const dir = await mkdtemp(join(tmpdir(), 'badgi-video-'));
    const output = join(dir, 'drawing.mp4');
    try {
      const ffmpeg = spawn(
        this.ffmpegPath,
        [
          '-y',
          '-f', 'rawvideo',
          '-pix_fmt', 'rgb24',
          '-s', `${VIDEO_SIZE}x${VIDEO_SIZE}`,
          '-r', String(FPS),
          '-i', 'pipe:0',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '24',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          output,
        ],
        { stdio: ['pipe', 'ignore', 'pipe'] },
      );
      let stderr = '';
      ffmpeg.stderr.on('data', (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));
      const done = new Promise<void>((resolve, reject) => {
        ffmpeg.on('error', reject);
        ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${stderr}`))));
      });
      // A failed ffmpeg must surface as its exit error, not as an unhandled EPIPE.
      ffmpeg.stdin.on('error', () => undefined);

      const write = (frame: Buffer) =>
        new Promise<void>((resolve) => (ffmpeg.stdin.write(frame) ? resolve() : ffmpeg.stdin.once('drain', resolve)));

      try {
        await this.writeFrames(input, write);
      } finally {
        ffmpeg.stdin.end();
      }
      await done;
      return await readFile(output);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async writeFrames(input: DrawingVideoInput, write: (frame: Buffer) => Promise<void>) {
    const toRaw = (image: Buffer) =>
      sharp(image).resize(VIDEO_SIZE, VIDEO_SIZE, { fit: 'cover' }).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer();
    const onWhite = (layers: sharp.OverlayOptions[]) =>
      sharp({ create: { width: VIDEO_SIZE, height: VIDEO_SIZE, channels: 3, background: '#ffffff' } })
        .composite(layers)
        // Compositing an overlay with alpha yields RGBA; ffmpeg expects exactly 3 bytes/pixel.
        .removeAlpha()
        .raw()
        .toBuffer();

    const { paths, strokeAttributes } = parseSketch(input.sketchSvg);
    const total = paths.reduce((sum, p) => sum + p.length, 0);
    const fullInk = Buffer.from(inkSvg(paths, strokeAttributes, total));

    // 1. Ink.
    const inkFrames = INK_SECONDS * FPS;
    for (let f = 1; f <= inkFrames; f++) {
      await write(await onWhite([{ input: Buffer.from(inkSvg(paths, strokeAttributes, (f / inkFrames) * total)) }]));
    }

    // 2. Colour brushed in under the ink.
    const color = await sharp(input.color).resize(VIDEO_SIZE, VIDEO_SIZE, { fit: 'cover' }).ensureAlpha().png().toBuffer();
    const colorFrames = COLOR_SECONDS * FPS;
    let painted: Buffer = Buffer.alloc(0);
    for (let f = 1; f <= colorFrames; f++) {
      const mask = Buffer.from(brushMaskSvg(f / colorFrames));
      const strokes = await sharp(color).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
      painted = await onWhite([{ input: strokes }, { input: fullInk }]);
      await write(painted);
    }

    // 3. Fade to the framed portrait, then hold it.
    const framed = await toRaw(input.framed);
    const fadeFrames = FRAME_SECONDS * FPS;
    for (let f = 1; f <= fadeFrames; f++) await write(blend(painted, framed, easeInOut(f / fadeFrames)));
    for (let f = 0; f < HOLD_SECONDS * FPS; f++) await write(framed);
  }
}
