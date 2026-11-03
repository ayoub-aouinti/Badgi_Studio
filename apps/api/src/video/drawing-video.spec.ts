import { inkSvg, parseSketch } from './drawing-video';

const SKETCH =
  '<svg viewBox="0 0 480 480" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">' +
  '<g fill="none" stroke="#0E1B2C" stroke-width="2.5"><path d="M 0 0 L 30 40"/><path d="M 100 100 L 100 150"/></g></svg>';

describe('drawing video', () => {
  it('reads the traced paths with their (control polygon) lengths and the stroke style', () => {
    const { paths, strokeAttributes } = parseSketch(SKETCH);
    expect(paths.map((p) => p.length)).toEqual([50, 50]);
    expect(strokeAttributes).toContain('stroke="#0E1B2C"');
  });

  it('inks paths one after another', () => {
    const { paths, strokeAttributes } = parseSketch(SKETCH);

    expect(inkSvg(paths, strokeAttributes, 0)).not.toContain('<path');
    // Halfway through the first stroke: a dashed, partly drawn path, the second not started.
    const halfway = inkSvg(paths, strokeAttributes, 25);
    expect(halfway.match(/<path/g)).toHaveLength(1);
    expect(halfway).toContain('stroke-dashoffset="25"');
    // First stroke done, second halfway.
    const later = inkSvg(paths, strokeAttributes, 75);
    expect(later.match(/<path/g)).toHaveLength(2);
    expect(later).toContain('<path d="M 0 0 L 30 40"/>');
    // Everything inked: no dashes left.
    expect(inkSvg(paths, strokeAttributes, 100)).not.toContain('dasharray');
  });

  it('renders at the video size', () => {
    const { paths, strokeAttributes } = parseSketch(SKETCH);
    expect(inkSvg(paths, strokeAttributes, 100)).toContain('width="720" height="720"');
  });
});
