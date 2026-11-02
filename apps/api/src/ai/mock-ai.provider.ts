import { Injectable } from '@nestjs/common';
import { StudioStyle } from '@prisma/client';
import sharp from 'sharp';
import { AiProvider, GeneratedPortrait } from './ai-provider.interface';

// Free, local "AI" effect: color grading + median smoothing + vignette per style, so each
// style reads as a distinct treatment instead of a flat Instagram-style color-tint filter
// (an earlier version used sharp's .tint(), which desaturates everything into one duotone
// hue and looks nothing like a "painted" or "caricature" style — removed).
type StylePipeline = {
  saturation: number;
  brightness: number;
  hue: number;
  contrast: number;
  median?: number;
  sharpen: boolean;
  vignette: number;
};

const PRO: StylePipeline = {
  saturation: 0.92,
  brightness: 1.02,
  hue: 0,
  contrast: 1.1,
  sharpen: true,
  vignette: 0.22,
};
const CARICATURE: StylePipeline = {
  saturation: 1.65,
  brightness: 1.05,
  hue: 8,
  contrast: 1.25,
  median: 3,
  sharpen: true,
  vignette: 0.12,
};

function isPencil(style: StudioStyle): boolean {
  return /crayon|pencil/i.test(style.name);
}

function pipelineForStyle(style: StudioStyle): StylePipeline {
  return style.name.toLowerCase().includes('caricature') ? CARICATURE : PRO;
}

// Black pencil drawing: the classic "colour dodge of the inverted blur" trick. Flat areas go
// white, edges and shading stay as graphite strokes.
async function pencilSketch(selfie: Buffer): Promise<Buffer> {
  const gray = await sharp(selfie)
    .rotate()
    .resize(1024, 1024, { fit: 'cover' })
    .grayscale()
    .normalise()
    .png()
    .toBuffer();
  const invertedBlur = await sharp(gray).negate().blur(10).png().toBuffer();
  const lines = await sharp(gray)
    .composite([{ input: invertedBlur, blend: 'colour-dodge' }])
    .grayscale()
    .png()
    .toBuffer();
  // Flat areas dodge to pure white, including dark beards and hair; a light tonal wash
  // (the blurred photo, compressed to 140-255) puts graphite shading back under the lines.
  const shade = await sharp(gray).blur(4).linear(0.45, 140).png().toBuffer();
  return sharp(lines)
    .composite([{ input: shade, blend: 'multiply' }])
    .grayscale()
    .gamma(1.3)
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function applyVignette(image: Buffer, strength: number): Promise<Buffer> {
  if (!strength) return image;
  const { width = 1024, height = 1024 } = await sharp(image).metadata();
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="v" cx="50%" cy="45%" r="72%">
          <stop offset="55%" stop-color="black" stop-opacity="0" />
          <stop offset="100%" stop-color="black" stop-opacity="${strength}" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#v)" />
    </svg>
  `;
  return sharp(image)
    .composite([{ input: Buffer.from(svg), blend: 'multiply' }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

@Injectable()
export class MockAiProvider implements AiProvider {
  async generate(selfie: Buffer, style: StudioStyle): Promise<GeneratedPortrait> {
    const image = isPencil(style) ? await pencilSketch(selfie) : await this.retouch(selfie, style);
    return { image, illustration: false };
  }

  // Colour-graded photo per style; also used by AnimeGanAiProvider for the "pro" style.
  async retouch(selfie: Buffer, style: StudioStyle): Promise<Buffer> {
    const p = pipelineForStyle(style);

    let pipeline = sharp(selfie).rotate().resize(1024, 1024, { fit: 'cover' });

    if (p.median) {
      // Median smoothing flattens fine texture into brush-stroke-like patches (oil-paint feel)
      // while keeping edges, instead of a uniform blur.
      pipeline = pipeline.median(p.median);
    }

    pipeline = pipeline
      .modulate({ saturation: p.saturation, brightness: p.brightness, hue: p.hue })
      .linear(p.contrast, 128 * (1 - p.contrast));

    if (p.sharpen) {
      pipeline = pipeline.sharpen();
    }

    const graded = await pipeline.jpeg({ quality: 92 }).toBuffer();
    return applyVignette(graded, p.vignette);
  }
}
