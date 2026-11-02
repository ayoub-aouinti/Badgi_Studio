import sharp from 'sharp';
import { FrameOptions, FrameService } from './frame.service';

jest.setTimeout(30000);

const base: FrameOptions = {
  style: 'banner',
  color: '#0E1B2C',
  width: 32,
  accentColor: '#5FD3C8',
  participantName: 'Amira Ben Ali',
  eventName: 'Congrès & Démo',
  tagline: 'Souvenir',
};

async function dimensions(buffer: Buffer) {
  const { width, height } = await sharp(buffer).metadata();
  return { width, height };
}

describe('FrameService', () => {
  const service = new FrameService();
  let portrait: Buffer;
  let logo: Buffer;

  beforeAll(async () => {
    portrait = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#996633' } })
      .jpeg()
      .toBuffer();
    logo = await sharp({ create: { width: 40, height: 20, channels: 4, background: '#ff0000' } })
      .png()
      .toBuffer();
  });

  it('keeps the portrait size for "none" and "banner"', async () => {
    for (const style of ['none', 'banner'] as const) {
      const out = await service.apply(portrait, { ...base, style, logo });
      expect(await dimensions(out)).toEqual({ width: 1024, height: 1024 });
    }
  });

  it('grows the canvas for "border" and "polaroid" (polaroid has the taller bottom)', async () => {
    const border = await dimensions(await service.apply(portrait, { ...base, style: 'border' }));
    const polaroid = await dimensions(await service.apply(portrait, { ...base, style: 'polaroid' }));
    expect(border.width).toBe(1024 + 64);
    expect(border.height!).toBeGreaterThan(1024 + 32);
    expect(polaroid.height!).toBeGreaterThan(border.height!);
  });

  it('omits the name row when no participant name is given', async () => {
    const withName = await service.apply(portrait, { ...base, style: 'border' });
    const withoutName = await service.apply(portrait, { ...base, style: 'border', participantName: undefined });
    expect((await dimensions(withoutName)).height).toBeLessThan((await dimensions(withName)).height!);
  });
});
