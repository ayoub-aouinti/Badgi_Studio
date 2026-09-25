import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { trace } from 'potrace';

const TRACE_SIZE = 480;

// Classic "pencil sketch" technique (greyscale dodge-blended against a heavily blurred,
// inverted copy of itself) rather than a raw edge-detection kernel — a Laplacian/Sobel
// pass on a real photo is numerically unstable (a near step-function between "all black"
// and "all white" a few threshold units apart) and traces flat silhouettes, not usable
// line art. The dodge technique produces genuine pencil-like shading that potrace can
// binarize cleanly. A radial vignette then fades the (usually busy) background toward
// white before tracing, since we have no face-segmentation model to isolate the subject —
// the kiosk capture oval keeps the face roughly centered, which is all this needs.
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

  async traceToSvg(image: Buffer): Promise<string | null> {
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

      const pencil = await sharp(dodged)
        .composite([{ input: Buffer.from(VIGNETTE_SVG) }])
        .png()
        .toBuffer();

      const raw = await new Promise<string>((resolve, reject) => {
        trace(
          pencil,
          { threshold: 215, color: 'black', background: 'transparent', turdSize: 15, blackOnWhite: true },
          (err, svg) => (err ? reject(err) : resolve(svg)),
        );
      });

      // potrace emits filled silhouettes ( stroke="none" fill="black" ); turn them into open
      // strokes so the frontend can animate stroke-dashoffset (a "drawing" reveal instead of
      // a shape fade-in), and pin a viewBox since we control the traced size exactly.
      return raw
        .replace(/<svg[^>]*>/, `<svg viewBox="0 0 ${TRACE_SIZE} ${TRACE_SIZE}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">`)
        .replace(/stroke="[^"]*"\s*/g, '')
        .replace(/fill="[^"]*"/g, 'fill="none" stroke="#0E1B2C" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"');
    } catch (error) {
      this.logger.warn(`Sketch tracing failed, continuing without it: ${(error as Error).message}`);
      return null;
    }
  }
}
