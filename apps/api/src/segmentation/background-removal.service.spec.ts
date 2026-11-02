import { portraitCrop } from './background-removal.service';

// Draws a simple silhouette into a mask: a head (narrow block) above wide shoulders.
function silhouette(width: number, height: number): Buffer {
  const mask = Buffer.alloc(width * height);
  const fill = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * width + x] = 255;
  };
  fill(80, 100, 120, 160); // head: 40px wide, centred on x=100
  fill(40, 160, 160, 200); // shoulders: 120px wide
  return mask;
}

describe('portraitCrop', () => {
  it('frames the head and shoulders around the head, not the full silhouette', () => {
    const crop = portraitCrop(silhouette(200, 200), 200, 200);

    expect(crop).not.toBeNull();
    // Head width ~39 (widest row in the top 35%, shoulders excluded) -> side ~ 2.1x.
    expect(crop!.side).toBeGreaterThan(70);
    expect(crop!.side).toBeLessThan(100);
    // Centred on the head horizontally, starting a bit above it.
    expect(Math.abs(crop!.left + crop!.side / 2 - 100)).toBeLessThanOrEqual(1);
    expect(crop!.top).toBeLessThan(100);
  });

  it('returns null when the mask is empty', () => {
    expect(portraitCrop(Buffer.alloc(100 * 100), 100, 100)).toBeNull();
  });
});
