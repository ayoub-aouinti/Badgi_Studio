import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { trace } from 'potrace';

const TRACE_SIZE = 480;

// Classic "pencil sketch" technique (greyscale dodge-blended against a heavily blurred,
// inverted copy of itself) rather than a raw edge-detection kernel — a Laplacian/Sobel
// pass on a real photo is numerically unstable (a near step-function between "all black"
// and "all white" a few threshold units apart) and traces flat silhouettes, not usable
// line art. The dodge technique produces genuine pencil-like shading that potrace can
// binarize cleanly.
//
// Normally the image is already isolated (BackgroundRemovalService: person on a plain
// background), so we trace with a sensitive threshold to keep collar/shoulders. If isolation
// was unavailable, a radial vignette fades the (usually busy) background toward white and a
// stricter threshold keeps the trace from being dominated by it — the kiosk capture oval
// keeps the face roughly centered, which is all that fallback needs.
const ISOLATED = { threshold: 235, turdSize: 12, vignette: false };
const FALLBACK = { threshold: 215, turdSize: 15, vignette: true };

const VIGNETTE_SVG = `
  <svg width="${TRACE_SIZE}" height="${TRACE_SIZE}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="v" cx="50%" cy="42%" r="55%">
        <stop offset="30%" stop-color="white" stop-opacity="0" />
        <stop offset="100%" stop-color="white" stop-opacity="1" />
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#v)" />
  </svg>
`;

@Injectable()
export class SketchService {
  private readonly logger = new Logger(SketchService.name);

  async traceToSvg(image: Buffer, options: { isolated: boolean }): Promise<string | null> {
    const settings = options.isolated ? ISOLATED : FALLBACK;
    try {
      const [gray, blurredInverted] = await Promise.all([
        sharp(image).resize(TRACE_SIZE, TRACE_SIZE, { fit: 'cover' }).greyscale().toBuffer(),
        sharp(image)
          .resize(TRACE_SIZE, TRACE_SIZE, { fit: 'cover' })
          .greyscale()
          .negate()
          .blur(10)
          .toBuffer(),
      ]);

      // Two separate composite passes (materializing an intermediate buffer) rather than
      // chaining .composite().composite() in one pipeline — empirically, chaining them
      // produced a visibly degraded/sparser trace than doing the dodge blend, re-encoding,
      // then applying the vignette as its own pass.
      const dodged = await sharp(gray)
        .composite([{ input: blurredInverted, blend: 'colour-dodge' }])
        .toBuffer();

      const pencil = settings.vignette
        ? await sharp(dodged).composite([{ input: Buffer.from(VIGNETTE_SVG) }]).png().toBuffer()
        : await sharp(dodged).png().toBuffer();

      const raw = await new Promise<string>((resolve, reject) => {
        trace(
          pencil,
          {
            threshold: settings.threshold,
            color: 'black',
            background: 'transparent',
            turdSize: settings.turdSize,
            blackOnWhite: true,
          },
          (err, svg) => (err ? reject(err) : resolve(svg)),
        );
      });

      return toStrokeSvg(raw, TRACE_SIZE);
    } catch (error) {
      this.logger.warn(`Sketch tracing failed, continuing without it: ${(error as Error).message}`);
      return null;
    }
  }
}

const ROW_HEIGHT = 32;

// potrace emits one filled silhouette path whose `d` holds every shape as a subpath. Split it
// into one open-stroke <path> per shape, ordered like an artist inks (row by row, top to
// bottom, alternating direction so the pen doesn't jump back across the page), so the
// frontend can draw them one after another with stroke-dashoffset.
export function toStrokeSvg(raw: string, size: number): string {
  const subpaths = [...raw.matchAll(/\sd="([^"]+)"/g)]
    .flatMap((match) => match[1].split(/(?=M\s*-?\d)/))
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const start = d.match(/^M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/);
      return { d, x: start ? Number(start[1]) : 0, y: start ? Number(start[2]) : 0 };
    })
    .sort((a, b) => {
      const rowA = Math.floor(a.y / ROW_HEIGHT);
      const rowB = Math.floor(b.y / ROW_HEIGHT);
      if (rowA !== rowB) return rowA - rowB;
      return rowA % 2 === 0 ? a.x - b.x : b.x - a.x;
    });

  const paths = subpaths.map((s) => `<path d="${s.d}"/>`).join('');
  return (
    `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">` +
    `<g fill="none" stroke="#0E1B2C" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">` +
    paths +
    `</g></svg>`
  );
}
