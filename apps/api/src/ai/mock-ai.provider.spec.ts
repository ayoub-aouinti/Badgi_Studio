import sharp from 'sharp';
import { StudioStyle } from '@prisma/client';
import type { StylePreset } from '@badgi-studio/shared';
import { MockAiProvider } from './mock-ai.provider';
import { CaricatureWarper } from './caricature-warp';
import { FaceDetector } from './face-detector';

function fakeStyle(preset: StylePreset): StudioStyle {
  return {
    id: 'style-1',
    configId: 'config-1',
    name: preset,
    preset,
    prompt: 'test prompt',
    model: 'mock',
    previewKey: null,
    sortOrder: 0,
    active: true,
  };
}

async function tinySelfie(): Promise<Buffer> {
  return sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 200, g: 150, b: 120 } },
  })
    .jpeg()
    .toBuffer();
}

// sharp renders 1024px images here; under a loaded machine with suites in parallel this has
// exceeded Jest's default 5 s.
jest.setTimeout(20000);

describe('MockAiProvider', () => {
  const provider = new MockAiProvider();

  it('returns a valid JPEG buffer distinct from the input selfie', async () => {
    const selfie = await tinySelfie();

    const result = await provider.generate(selfie, fakeStyle('pro'));

    expect(Buffer.isBuffer(result.image)).toBe(true);
    expect(result.illustration).toBe(false);
    const meta = await sharp(result.image).metadata();
    expect(meta.format).toBe('jpeg');
    expect(result.image.equals(selfie)).toBe(false);
  });

  it('applies a different pipeline per preset', async () => {
    const selfie = await tinySelfie();
    const presets: StylePreset[] = ['pro', 'caricature', 'pencil', 'painted', 'comic'];

    const results = await Promise.all(presets.map((preset) => provider.generate(selfie, fakeStyle(preset))));

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        expect(results[i].image.equals(results[j].image)).toBe(false);
      }
    }
    // Flat colours + ink: traced directly for the live drawing.
    expect(results[presets.indexOf('comic')].illustration).toBe(true);
  });

  it('traces a warped caricature from the warped photo, not the original selfie', async () => {
    const selfie = await tinySelfie();
    const detector = { detect: jest.fn().mockResolvedValue({ x: 0.3, y: 0.3, width: 0.4, height: 0.4, score: 0.99 }) };
    const warping = new MockAiProvider(new CaricatureWarper(detector as unknown as FaceDetector));

    const result = await warping.generate(selfie, fakeStyle('caricature'));

    expect(detector.detect).toHaveBeenCalled();
    expect(result.lineArtSource).toBeDefined();
    expect(result.illustration).toBe(false);
  });

  it('falls back to a colour-only caricature when no face is found', async () => {
    const detector = { detect: jest.fn().mockResolvedValue(null) };
    const warping = new MockAiProvider(new CaricatureWarper(detector as unknown as FaceDetector));

    const result = await warping.generate(await tinySelfie(), fakeStyle('caricature'));

    expect(result.lineArtSource).toBeUndefined();
  });
});
