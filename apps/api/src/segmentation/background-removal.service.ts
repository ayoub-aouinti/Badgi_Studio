import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';
import type { InferenceSession } from 'onnxruntime-node';

const MODEL_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const DEFAULT_MODEL_PATH = resolve(process.cwd(), 'models/u2netp.onnx');

// Isolates the participant from their surroundings (free, local: onnxruntime-node + the
// Apache-2.0 U²-Net "u2netp" model) and puts them on a plain studio background, so both
// the AI styling and the line-art trace work on the person only — a busy background (a
// bookshelf, a crowd) otherwise dominates the "live drawing". If the model file is missing
// (`pnpm --filter @badgi-studio/api models:download`), the original image is returned.
@Injectable()
export class BackgroundRemovalService {
  private readonly logger = new Logger(BackgroundRemovalService.name);
  private readonly modelPath: string;
  private readonly background: string;
  private session?: Promise<InferenceSession | null>;

  constructor(config: ConfigService) {
    this.modelPath = config.get<string>('BG_REMOVAL_MODEL_PATH') || DEFAULT_MODEL_PATH;
    this.background = config.get<string>('BG_REMOVAL_BACKGROUND') || '#F4F6F5';
  }

  private getSession(): Promise<InferenceSession | null> {
    if (!this.session) {
      this.session = (async () => {
        if (!existsSync(this.modelPath)) {
          this.logger.warn(`No segmentation model at ${this.modelPath}, background removal disabled`);
          return null;
        }
        const ort = await import('onnxruntime-node');
        return ort.InferenceSession.create(this.modelPath);
      })().catch((error: Error) => {
        this.logger.warn(`Could not load segmentation model: ${error.message}`);
        return null;
      });
    }
    return this.session;
  }

  async removeBackground(image: Buffer): Promise<{ image: Buffer; isolated: boolean }> {
    const session = await this.getSession();
    if (!session) return { image, isolated: false };

    try {
      const oriented = await sharp(image).rotate().removeAlpha().toBuffer({ resolveWithObject: true });
      const { width, height } = oriented.info;

      const { data: pixels } = await sharp(oriented.data)
        .resize(MODEL_SIZE, MODEL_SIZE, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // HWC uint8 -> CHW float32, ImageNet-normalized (U²-Net's training preprocessing).
      const plane = MODEL_SIZE * MODEL_SIZE;
      const input = new Float32Array(3 * plane);
      for (let i = 0; i < plane; i++) {
        for (let c = 0; c < 3; c++) {
          input[c * plane + i] = (pixels[i * 3 + c] / 255 - MEAN[c]) / STD[c];
        }
      }

      const ort = await import('onnxruntime-node');
      const outputs = await session.run({
        [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]),
      });
      const prediction = outputs[session.outputNames[0]].data as Float32Array;

      let min = Infinity;
      let max = -Infinity;
      for (const v of prediction) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const range = max - min || 1;
      const mask = Buffer.alloc(plane);
      for (let i = 0; i < plane; i++) {
        mask[i] = Math.round(((prediction[i] - min) / range) * 255);
      }

      const fullMask = await sharp(mask, { raw: { width: MODEL_SIZE, height: MODEL_SIZE, channels: 1 } })
        .resize(width, height, { fit: 'fill' })
        .blur(1)
        .extractChannel(0)
        .raw()
        .toBuffer();

      const cutout = await sharp(oriented.data)
        .joinChannel(fullMask, { raw: { width, height, channels: 1 } })
        .png()
        .toBuffer();

      let subject = sharp(cutout).flatten({ background: this.background });
      const crop = portraitCrop(fullMask, width, height);
      if (crop) {
        subject = sharp(await subject.png().toBuffer()).extract({
          left: crop.left,
          top: crop.top,
          width: crop.side,
          height: crop.side,
        });
      }
      return { image: await subject.jpeg({ quality: 95 }).toBuffer(), isolated: true };
    } catch (error) {
      this.logger.warn(`Background removal failed, using original image: ${(error as Error).message}`);
      return { image, isolated: false };
    }
  }
}

// Head-and-shoulders square framing from the person mask. Portrait models (and the traced
// drawing) look far better when the face fills the frame; a kiosk/webcam selfie usually has
// a lot of headroom and the face covers maybe a third of the width. Head = widest mask row
// in the top 35% of the silhouette (above the shoulders); the square is ~2.1x the head width
// with the head in the upper part.
export function portraitCrop(
  mask: Buffer,
  width: number,
  height: number,
): { left: number; top: number; side: number } | null {
  const rowExtent: Array<[number, number] | null> = new Array(height).fill(null);
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 128) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left >= 0) {
      rowExtent[y] = [left, right];
      if (top < 0) top = y;
      bottom = y;
    }
  }
  if (top < 0) return null;

  let headWidth = 0;
  let headCenter = width / 2;
  const headZoneEnd = top + (bottom - top) * 0.35;
  for (let y = top; y <= headZoneEnd; y++) {
    const extent = rowExtent[y];
    if (!extent) continue;
    const w = extent[1] - extent[0];
    if (w > headWidth) {
      headWidth = w;
      headCenter = (extent[0] + extent[1]) / 2;
    }
  }
  if (headWidth < 16) return null;

  const side = Math.min(width, height, Math.round(headWidth * 2.1));
  return {
    side,
    left: Math.max(0, Math.min(width - side, Math.round(headCenter - side / 2))),
    top: Math.max(0, Math.min(height - side, Math.round(top - headWidth * 0.3))),
  };
}
