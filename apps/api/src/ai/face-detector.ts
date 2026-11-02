import { Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import sharp from 'sharp';
import type { InferenceSession } from 'onnxruntime-node';

const INPUT_WIDTH = 320;
const INPUT_HEIGHT = 240;
const MIN_SCORE = 0.7;

// Face box in [0, 1] coordinates of the image passed to detect().
export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

// Free, local face detector: Ultra-Light-Fast-Generic-Face-Detector-1MB (RFB-320, MIT) on
// onnxruntime-node, ~20 ms on CPU. Returns null when the model file is missing
// (`pnpm --filter @badgi-studio/api models:download`) or no face is found.
export class FaceDetector {
  private readonly logger = new Logger(FaceDetector.name);
  private session?: Promise<InferenceSession | null>;

  constructor(private readonly modelPath: string) {}

  private getSession(): Promise<InferenceSession | null> {
    if (!this.session) {
      this.session = (async () => {
        if (!existsSync(this.modelPath)) {
          this.logger.warn(`No face detection model at ${this.modelPath}, caricature warp disabled`);
          return null;
        }
        const ort = await import('onnxruntime-node');
        // Severity 3: the exported graph lists its weights as inputs, which only logs warnings.
        return ort.InferenceSession.create(this.modelPath, { logSeverityLevel: 3 });
      })().catch((error: Error) => {
        this.logger.warn(`Could not load face detection model: ${error.message}`);
        return null;
      });
    }
    return this.session;
  }

  async detect(image: Buffer): Promise<FaceBox | null> {
    const session = await this.getSession();
    if (!session) return null;

    // Stretched to the model size: boxes come back normalised, so they map straight back.
    const { data: pixels } = await sharp(image)
      .resize(INPUT_WIDTH, INPUT_HEIGHT, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // HWC uint8 -> CHW float32, (x - 127) / 128 (the detector's training preprocessing).
    const plane = INPUT_WIDTH * INPUT_HEIGHT;
    const input = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      for (let c = 0; c < 3; c++) input[c * plane + i] = (pixels[i * 3 + c] - 127) / 128;
    }

    const ort = await import('onnxruntime-node');
    const outputs = await session.run({
      [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, INPUT_HEIGHT, INPUT_WIDTH]),
    });
    const scores = outputs.scores.data as Float32Array;
    const boxes = outputs.boxes.data as Float32Array;

    // A kiosk selfie has one main subject: keep the largest confident box (anchors overlap,
    // so this also stands in for non-maximum suppression).
    let best: FaceBox | null = null;
    for (let i = 0; i < scores.length / 2; i++) {
      const score = scores[i * 2 + 1];
      if (score < MIN_SCORE) continue;
      const x1 = Math.max(0, boxes[i * 4]);
      const y1 = Math.max(0, boxes[i * 4 + 1]);
      const x2 = Math.min(1, boxes[i * 4 + 2]);
      const y2 = Math.min(1, boxes[i * 4 + 3]);
      const box = { x: x1, y: y1, width: x2 - x1, height: y2 - y1, score };
      if (box.width <= 0 || box.height <= 0) continue;
      if (!best || box.width * box.height > best.width * best.height) best = box;
    }
    return best;
  }
}
