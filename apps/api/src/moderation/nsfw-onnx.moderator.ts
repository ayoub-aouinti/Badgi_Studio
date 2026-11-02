import { Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import sharp from 'sharp';
import type { InferenceSession } from 'onnxruntime-node';
import { ContentModerator, ModerationVerdict } from './content-moderator.interface';

const INPUT_SIZE = 224;
const NSFW_CLASS = 1;

export function softmax(logits: ArrayLike<number>): number[] {
  const max = Math.max(...Array.from(logits));
  const exps = Array.from(logits, (value) => Math.exp(value - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((value) => value / sum);
}

// MODERATION_DRIVER=local: free, local NSFW image classifier (Falconsai/nsfw_image_detection,
// ViT, Apache-2.0; int8 ONNX, ~250 ms on CPU). Labels: 0 = normal, 1 = nsfw. Without the model
// file every selfie is accepted (a warning is logged once), like the other local models.
export class NsfwOnnxModerator implements ContentModerator {
  private readonly logger = new Logger(NsfwOnnxModerator.name);
  private session?: Promise<InferenceSession | null>;

  constructor(
    private readonly modelPath: string,
    private readonly threshold: number,
  ) {}

  private getSession(): Promise<InferenceSession | null> {
    if (!this.session) {
      this.session = (async () => {
        if (!existsSync(this.modelPath)) {
          this.logger.warn(`No moderation model at ${this.modelPath}, automatic moderation disabled`);
          return null;
        }
        const ort = await import('onnxruntime-node');
        return ort.InferenceSession.create(this.modelPath, { logSeverityLevel: 3 });
      })().catch((error: Error) => {
        this.logger.warn(`Could not load moderation model: ${error.message}`);
        return null;
      });
    }
    return this.session;
  }

  async check(image: Buffer): Promise<ModerationVerdict> {
    const session = await this.getSession();
    if (!session) return { flagged: false };
    // A broken check must not stop the kiosk: the selfie is let through (and logged); the
    // organiser can still moderate the wall by hand.
    try {
      return await this.classify(session, image);
    } catch (error) {
      this.logger.warn(`Automatic moderation failed, selfie accepted: ${(error as Error).message}`);
      return { flagged: false };
    }
  }

  private async classify(session: InferenceSession, image: Buffer): Promise<ModerationVerdict> {
    const { data: pixels } = await sharp(image)
      .rotate()
      .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // HWC uint8 -> CHW float32, (x / 255 - 0.5) / 0.5 (ViTFeatureExtractor of the model).
    const plane = INPUT_SIZE * INPUT_SIZE;
    const input = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      for (let c = 0; c < 3; c++) input[c * plane + i] = pixels[i * 3 + c] / 127.5 - 1;
    }

    const ort = await import('onnxruntime-node');
    const outputs = await session.run({
      [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    });
    const score = softmax(outputs[session.outputNames[0]].data as Float32Array)[NSFW_CLASS];
    return score >= this.threshold
      ? { flagged: true, reason: `Contenu inapproprié détecté (${Math.round(score * 100)} %)` }
      : { flagged: false };
  }
}
