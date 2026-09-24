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

describe('MockAiProvider', () => {
  const provider = new MockAiProvider();

  it('returns a valid JPEG buffer distinct from the input selfie', async () => {
    const selfie = await tinySelfie();

    const result = await provider.generate(selfie, fakeStyle('Portrait professionnel'));

    expect(Buffer.isBuffer(result)).toBe(true);
    const meta = await sharp(result).metadata();
    expect(meta.format).toBe('jpeg');
    expect(result.equals(selfie)).toBe(false);
  });

  it('applies a different pipeline per style (caricature vs painted vs pro)', async () => {
    const selfie = await tinySelfie();

    const [pro, caricature, peint] = await Promise.all([
      provider.generate(selfie, fakeStyle('Portrait professionnel')),
      provider.generate(selfie, fakeStyle('Caricature spécialité')),
      provider.generate(selfie, fakeStyle('Portrait peint')),
    ]);

    expect(pro.equals(caricature)).toBe(false);
    expect(pro.equals(peint)).toBe(false);
    expect(caricature.equals(peint)).toBe(false);
  });
});
