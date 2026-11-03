// Geometry of the live drawing's colour pass ("brush strokes"), shared by the wall and kiosk
// animations (canvas) and the server-rendered MP4 (apps/api VideoService), so all three paint
// the same way.

export type Point = [number, number];

// Serpentine rows, each one brush stroke.
export const BRUSH_ROWS = 9;

// Brush width relative to the image size (row height x 1.45: rows overlap, no gaps).
export const BRUSH_WIDTH_RATIO = 1.45 / BRUSH_ROWS;

export function brushStrokes(size: number): Point[][] {
  const rowHeight = size / BRUSH_ROWS;
  const steps = 8;
  const strokes: Point[][] = [];
  for (let row = 0; row < BRUSH_ROWS; row++) {
    const y = rowHeight * (row + 0.5);
    const points: Point[] = [];
    for (let s = 0; s <= steps; s++) {
      const x = -rowHeight * 0.5 + ((size + rowHeight) * s) / steps;
      const wobble = Math.sin(row * 1.7 + s * 1.3) * rowHeight * 0.18;
      points.push([x, y + wobble]);
    }
    strokes.push(row % 2 === 0 ? points : points.reverse());
  }
  return strokes;
}

export function polylineLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return length;
}

export function truncatePolyline(points: Point[], length: number): Point[] {
  const out: Point[] = [points[0]];
  let remaining = length;
  for (let i = 1; i < points.length && remaining > 0; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const segment = Math.hypot(x1 - x0, y1 - y0);
    if (segment <= remaining) {
      out.push(points[i]);
      remaining -= segment;
    } else {
      const k = remaining / segment;
      out.push([x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]);
      remaining = 0;
    }
  }
  return out;
}
