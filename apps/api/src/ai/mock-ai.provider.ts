import { Injectable } from '@nestjs/common';
import { StudioStyle } from '@prisma/client';
import sharp from 'sharp';
import type { StylePreset } from '@badgi-studio/shared';
import { AiProvider, GeneratedPortrait } from './ai-provider.interface';
import { CaricatureWarper } from './caricature-warp';

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
  // Resolution the median runs at before scaling back up: lower = broader brush strokes.
  workingSize?: number;
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
// Wide median = broad flat patches with kept edges, the closest sharp gets to oil paint.
const PAINTED: StylePipeline = {
  saturation: 1.4,
  brightness: 1.04,
  hue: 4,
  contrast: 1.15,
  median: 7,
  workingSize: 384,
  sharpen: true,
  vignette: 0.15,
};

export function stylePreset(style: StudioStyle): StylePreset {
  return style.preset as StylePreset;
}

// Black pencil drawing: the classic "colour dodge of the inverted blur" trick. Flat areas go
// white, edges and shading stay as graphite strokes.
async function pencilLines(selfie: Buffer): Promise<{ gray: Buffer; lines: Buffer }> {
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
  return { gray, lines };
}

async function pencilSketch(selfie: Buffer): Promise<Buffer> {
  const { gray, lines } = await pencilLines(selfie);
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

// Comic book: a few flat colours (palette quantisation, no dithering) under bold black ink
// (the pencil lines thresholded and thickened).
async function comic(selfie: Buffer): Promise<Buffer> {
  // Smoothed at half size so the colour areas come out broad and clean.
  const smooth = await sharp(selfie).rotate().resize(512, 512, { fit: 'cover' }).median(5).toBuffer();
  const flat = await sharp(smooth)
    .resize(1024, 1024)
    .modulate({ saturation: 1.6, brightness: 1.08 })
    .linear(1.15, 128 * (1 - 1.15))
    .png({ palette: true, colours: 16, dither: 0 })
    .toBuffer();
  const { lines } = await pencilLines(selfie);
  // Thresholded dodge lines are thin and broken; blurring the (negated) lines and thresholding
  // low again thickens and closes them into the outlines of an inked panel.
  // negate({ alpha: false }): negating the alpha channel too would make the ink transparent.
  const thin = await sharp(lines).removeAlpha().threshold(220).negate({ alpha: false }).png().toBuffer();
  const ink = await sharp(thin)
    .blur(1.5)
    .threshold(50)
    .negate({ alpha: false })
    .toColourspace('b-w')
    .png()
    .toBuffer();
  return sharp(flat)
    .removeAlpha()
    .composite([{ input: ink, blend: 'multiply' }])
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
  // Without a warper (or a face), the caricature is a colour treatment only.
  constructor(private readonly caricature?: CaricatureWarper) {}

  async generate(selfie: Buffer, style: StudioStyle): Promise<GeneratedPortrait> {
    switch (stylePreset(style)) {
      case 'pencil':
        return { image: await pencilSketch(selfie), illustration: false };
      case 'comic':
        return { image: await comic(selfie), illustration: true };
      case 'painted':
        return { image: await this.retouch(selfie, PAINTED), illustration: false };
      case 'caricature': {
        const warped = this.caricature ? await this.caricature.warp(selfie) : null;
        if (!warped?.warped) return { image: await this.retouch(selfie, CARICATURE), illustration: false };
        return {
          image: await this.retouch(warped.image, CARICATURE),
          illustration: false,
          lineArtSource: warped.image,
        };
      }
      default:
        return { image: await this.retouch(selfie, PRO), illustration: false };
    }
  }

  // Colour-graded photo; also used by AnimeGanAiProvider for the "pro" style.
  async retouch(selfie: Buffer, p: StylePipeline = PRO): Promise<Buffer> {
    if (p.workingSize && p.median) {
      selfie = await sharp(selfie)
        .rotate()
        .resize(p.workingSize, p.workingSize, { fit: 'cover' })
        .median(p.median)
        .toBuffer();
    }

    let pipeline = sharp(selfie).rotate().resize(1024, 1024, { fit: 'cover', kernel: 'lanczos3' });

    if (p.median && !p.workingSize) {
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
