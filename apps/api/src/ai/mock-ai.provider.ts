import { Injectable } from '@nestjs/common';
import { StudioStyle } from '@prisma/client';
import sharp from 'sharp';
import { AiProvider } from './ai-provider.interface';

// Free, local "AI" effect (docs/SCREENS.md tints): color grading + sharpen/blur per style,
// so each style is visually distinct without calling any paid image model.
type StylePipeline = {
  tint: string;
  saturation: number;
  brightness: number;
  sharpen: boolean;
  blur?: number;
};

const PRO: StylePipeline = { tint: '#2D4A6B', saturation: 0.9, brightness: 1.05, sharpen: true };
const CARICATURE: StylePipeline = {
  tint: '#9A3B20',
  saturation: 1.5,
  brightness: 1.1,
  sharpen: true,
};
const PEINT: StylePipeline = { tint: '#2C6FB0', saturation: 1.15, brightness: 1.0, sharpen: false, blur: 1.5 };

function pipelineForStyle(style: StudioStyle): StylePipeline {
  const name = style.name.toLowerCase();
  if (name.includes('caricature')) return CARICATURE;
  if (name.includes('peint')) return PEINT;
  return PRO;
}

@Injectable()
export class MockAiProvider implements AiProvider {
  async generate(selfie: Buffer, style: StudioStyle): Promise<Buffer> {
    const p = pipelineForStyle(style);

    let pipeline = sharp(selfie)
      .rotate()
      .resize(1024, 1024, { fit: 'cover' })
      .modulate({ saturation: p.saturation, brightness: p.brightness })
      .tint(p.tint);

    if (p.blur) {
      pipeline = pipeline.blur(p.blur);
    }
    if (p.sharpen) {
      pipeline = pipeline.sharpen();
    }

    return pipeline.jpeg({ quality: 90 }).toBuffer();
  }
}
