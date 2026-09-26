import { toStrokeSvg } from './sketch.service';

describe('toStrokeSvg', () => {
  const raw =
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480">' +
    '<path d="M 300 100 C 1 2, 3 4, 5 6 M 10 10 L 20 20 M 50 12 L 60 60 M 400 200 L 410 210" ' +
    'stroke="none" fill="black" fill-rule="evenodd"/></svg>';

  it('splits the single potrace path into one stroked path per shape', () => {
    const svg = toStrokeSvg(raw, 480);
    expect(svg.match(/<path /g)).toHaveLength(4);
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#0E1B2C"');
    expect(svg).toContain('viewBox="0 0 480 480"');
  });

  it('orders strokes top-to-bottom, row by row', () => {
    const svg = toStrokeSvg(raw, 480);
    const starts = [...svg.matchAll(/d="M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    // Row 0 (y < 32): x ascending; then y=100 row; then y=200 row.
    expect(starts).toEqual([
      [10, 10],
      [50, 12],
      [300, 100],
      [400, 200],
    ]);
  });
});
