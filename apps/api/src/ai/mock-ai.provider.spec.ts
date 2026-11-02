import sharp from 'sharp';
import { StudioStyle } from '@prisma/client';
import { MockAiProvider } from './mock-ai.provider';

function fakeStyle(name: string): StudioStyle {
  return {
    id: 'style-1',
    configId: 'config-1',
    name,
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

    const result = await provider.generate(selfie, fakeStyle('Portrait professionnel'));

    expect(Buffer.isBuffer(result.image)).toBe(true);
    expect(result.illustration).toBe(false);
    const meta = await sharp(result.image).metadata();
    expect(meta.format).toBe('jpeg');
    expect(result.image.equals(selfie)).toBe(false);
  });

  it('applies a different pipeline per style (caricature vs pencil vs pro)', async () => {
    const selfie = await tinySelfie();

    const [pro, caricature, pencil] = await Promise.all([
      provider.generate(selfie, fakeStyle('Portrait professionnel')),
      provider.generate(selfie, fakeStyle('Caricature spécialité')),
      provider.generate(selfie, fakeStyle('Crayon noir')),
    ]);

    expect(pro.image.equals(caricature.image)).toBe(false);
    expect(pro.image.equals(pencil.image)).toBe(false);
    expect(caricature.image.equals(pencil.image)).toBe(false);
  });
});
