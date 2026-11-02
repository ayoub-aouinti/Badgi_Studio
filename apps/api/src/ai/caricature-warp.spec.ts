import { caricatureBulges, warpCaricature } from './caricature-warp';

const face = { x: 0.3, y: 0.25, width: 0.4, height: 0.5, score: 0.99 };

// Vertical stripes 1 px wide: easy to tell where each output pixel was sampled from.
function stripes(size: number): Buffer {
  const pixels = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) pixels.fill(x % 256, (y * size + x) * 3, (y * size + x) * 3 + 3);
  }
  return pixels;
}

describe('caricature warp', () => {
  it('places the eye bulges inside the face, on either side of its centre', () => {
    const { head, eyes } = caricatureBulges(face, 1000);
    expect(eyes).toHaveLength(2);
    const [left, right] = eyes;
    expect(left.cx).toBeLessThan(head.cx);
    expect(right.cx).toBeGreaterThan(head.cx);
    expect(left.cy).toBeGreaterThan(face.y * 1000);
    expect(left.cy).toBeLessThan((face.y + face.height) * 1000);
  });

  it('magnifies around the head centre and leaves the far corners untouched', () => {
    const size = 200;
    const input = stripes(size);
    const out = warpCaricature(input, size, face);
    const { head } = caricatureBulges(face, size);

    // Far corner: outside every bulge, identical pixel.
    expect(out[0]).toBe(input[0]);

    // A few pixels right of the centre, the output samples closer to the centre (magnified).
    const cy = Math.round(head.cy);
    const cx = Math.round(head.cx);
    const sampledX = out[(cy * size + cx + 20) * 3];
    expect(sampledX).toBeGreaterThan(cx);
    expect(sampledX).toBeLessThan(cx + 20);
  });

  it('keeps the image size', () => {
    const size = 64;
    expect(warpCaricature(stripes(size), size, face)).toHaveLength(size * size * 3);
  });
});
