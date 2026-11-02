import { restoreLuminance } from './animegan-ai.provider';

describe('restoreLuminance', () => {
  // Painted pixel ~1.5x darker than the photo (within the 0.5x-2.5x clamp).
  const painted = Buffer.from([80, 60, 40]);
  const original = Buffer.from([120, 90, 60]);

  it('brightens a darkened pixel toward the original lightness, keeping its hue', () => {
    const out = restoreLuminance(painted, original, 1);
    expect(out[0]).toBeGreaterThan(painted[0]);
    // Same scale factor on every channel -> hue (ratios) preserved.
    expect(out[0] / out[1]).toBeCloseTo(painted[0] / painted[1], 1);
  });

  it('leaves the pixel unchanged with amount 0', () => {
    expect([...restoreLuminance(painted, original, 0)]).toEqual([...painted]);
  });

  it('only moves part of the way with a partial amount', () => {
    const full = restoreLuminance(painted, original, 1);
    const partial = restoreLuminance(painted, original, 0.5);
    expect(partial[0]).toBeGreaterThan(painted[0]);
    expect(partial[0]).toBeLessThan(full[0]);
  });
});
