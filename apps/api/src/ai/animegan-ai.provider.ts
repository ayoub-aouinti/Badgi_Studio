import { Logger } from '@nestjs/common';
import { StudioStyle } from '@prisma/client';
import { existsSync } from 'fs';
import sharp from 'sharp';
import type { InferenceSession } from 'onnxruntime-node';
import { AiProvider, GeneratedPortrait } from './ai-provider.interface';
import { MockAiProvider, stylePreset } from './mock-ai.provider';
import { CaricatureWarper } from './caricature-warp';

const MODEL_SIZE = 512;
const OUTPUT_SIZE = 1024;

// Per-style finishing on top of the illustrated output. `luminance` = how much of the original
// photo's lightness is restored (see restoreLuminance): the face-paint model darkens tanned
// skin and beards heavily (tested on real kiosk selfies), which makes participants
// unrecognisable; restoring lightness keeps the painted texture but the real skin tone.
// "painted" keeps more of the model's own paint (less lightness restored, softer contrast).
const FINISH = {
  caricature: { luminance: 0.6, saturation: 1.3, brightness: 1.0, contrast: 1.12 },
  painted: { luminance: 0.45, saturation: 1.15, brightness: 1.02, contrast: 1.05 },
};

// Scales each painted pixel so its luminance moves `amount` of the way back to the original's
// (colour/texture from the model, lightness mostly from the photo).
export function restoreLuminance(painted: Buffer, original: Buffer, amount: number): Buffer {
  const out = Buffer.alloc(painted.length);
  for (let i = 0; i < painted.length; i += 3) {
    const lp = 0.299 * painted[i] + 0.587 * painted[i + 1] + 0.114 * painted[i + 2] + 1;
    const lo = 0.299 * original[i] + 0.587 * original[i + 1] + 0.114 * original[i + 2] + 1;
    const ratio = Math.min(2.5, Math.max(0.5, 1 + (lo / lp - 1) * amount));
    for (let c = 0; c < 3; c++) out[i + c] = Math.max(0, Math.min(255, Math.round(painted[i + c] * ratio)));
  }
  return out;
}

function illustratedStyle(style: StudioStyle): keyof typeof FINISH | null {
  const preset = stylePreset(style);
  return preset === 'caricature' || preset === 'painted' ? preset : null;
}

// AI_PROVIDER=animegan: free, local (onnxruntime-node, CPU ~3-4 s) illustrated portraits with
// the AnimeGAN2 "face paint" model (models/face_paint_512_v2_0.onnx, from
// bryandlee/animegan2-pytorch, MIT repo — confirm the weights' licence before commercial use).
// Used for the "painted" and "caricature" presets; the caricature is first exaggerated with the
// local face warp (bigger head and eyes, see caricature-warp.ts), then painted. The other
// presets stay local photo treatments (mock provider), which is also the fallback if the
// model file is missing.
export class AnimeGanAiProvider implements AiProvider {
  private readonly logger = new Logger(AnimeGanAiProvider.name);
  private session?: Promise<InferenceSession | null>;

  constructor(
    private readonly modelPath: string,
    private readonly fallback: MockAiProvider,
    private readonly caricature?: CaricatureWarper,
  ) {}

  private getSession(): Promise<InferenceSession | null> {
    if (!this.session) {
      this.session = (async () => {
        if (!existsSync(this.modelPath)) {
          this.logger.warn(`No AnimeGAN model at ${this.modelPath}, using the mock provider`);
          return null;
        }
        const ort = await import('onnxruntime-node');
        return ort.InferenceSession.create(this.modelPath);
      })().catch((error: Error) => {
        this.logger.warn(`Could not load AnimeGAN model: ${error.message}`);
        return null;
      });
    }
    return this.session;
  }

  async generate(selfie: Buffer, style: StudioStyle): Promise<GeneratedPortrait> {
    const target = illustratedStyle(style);
    const session = target ? await this.getSession() : null;
    if (!target || !session) return this.fallback.generate(selfie, style);

    if (target === 'caricature' && this.caricature) {
      selfie = (await this.caricature.warp(selfie)).image;
    }

    const { data: pixels } = await sharp(selfie)
      .rotate()
      .resize(MODEL_SIZE, MODEL_SIZE, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // HWC uint8 -> CHW float32 in [-1, 1] (AnimeGAN2 training range).
    const plane = MODEL_SIZE * MODEL_SIZE;
    const input = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      for (let c = 0; c < 3; c++) input[c * plane + i] = pixels[i * 3 + c] / 127.5 - 1;
    }

    const ort = await import('onnxruntime-node');
    const outputs = await session.run({
      [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]),
    });
    const result = outputs[session.outputNames[0]].data as Float32Array;

    const rgb = Buffer.alloc(plane * 3);
    for (let i = 0; i < plane; i++) {
      for (let c = 0; c < 3; c++) {
        rgb[i * 3 + c] = Math.max(0, Math.min(255, Math.round((result[c * plane + i] + 1) * 127.5)));
      }
    }

    const finish = FINISH[target];
    // Slightly blurred original so only broad lightness comes back, not photo detail.
    const originalLight = await sharp(selfie)
      .rotate()
      .resize(MODEL_SIZE, MODEL_SIZE, { fit: 'cover' })
      .removeAlpha()
      .blur(1.5)
      .raw()
      .toBuffer();
    const relit = restoreLuminance(rgb, originalLight, finish.luminance);

    const image = await sharp(relit, { raw: { width: MODEL_SIZE, height: MODEL_SIZE, channels: 3 } })
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { kernel: 'lanczos3' })
      .modulate({ saturation: finish.saturation, brightness: finish.brightness })
      .linear(finish.contrast, 128 * (1 - finish.contrast))
      .jpeg({ quality: 92 })
      .toBuffer();

    return { image, illustration: true };
  }
}
