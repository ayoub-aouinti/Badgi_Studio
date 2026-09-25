import { Injectable } from '@nestjs/common';
import { StudioStyle } from '@prisma/client';
import sharp from 'sharp';
import { AiProvider } from './ai-provider.interface';

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
const PEINT: StylePipeline = {
  saturation: 1.3,
  brightness: 1.0,
  hue: 14,
  contrast: 1.05,
  median: 9,
  sharpen: false,
  vignette: 0.35,
};

function pipelineForStyle(style: StudioStyle): StylePipeline {
  const name = style.name.toLowerCase();
  if (name.includes('caricature')) return CARICATURE;
  if (name.includes('peint')) return PEINT;
  return PRO;
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
  async generate(selfie: Buffer, style: StudioStyle): Promise<Buffer> {
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
