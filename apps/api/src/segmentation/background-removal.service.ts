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

      const flattened = await sharp(cutout)
        .flatten({ background: this.background })
        .jpeg({ quality: 95 })
        .toBuffer();
      return { image: flattened, isolated: true };
    } catch (error) {
      this.logger.warn(`Background removal failed, using original image: ${(error as Error).message}`);
      return { image, isolated: false };
    }
  }
}
