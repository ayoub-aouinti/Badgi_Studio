import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';

export type DrawPhase = 'loading' | 'ink' | 'color' | 'frame' | 'done';

interface DrawnPortraitProps {
  sketchUrl?: string;
  // Unframed AI result, painted in with brush strokes after the ink pass.
  colorUrl?: string;
  // Final framed image (name / congress / sponsor banner), faded in at the end.
  finalUrl: string;
  alt: string;
  inkMs?: number;
  colorMs?: number;
  className?: string;
  onPhaseChange?: (phase: DrawPhase) => void;
}

const VIEWBOX = 480; // matches apps/api SketchService TRACE_SIZE
const FRAME_MS = 900;
const BRUSH_ROWS = 9;

// "Live drawing" performance (docs/SCREENS.md écran 6b): the pen inks the traced outline
// stroke by stroke, then the colour is brushed in one stroke at a time, then the congress
// frame appears. Driven by a single requestAnimationFrame loop per phase (CSS transitions
// on stroke-dashoffset proved unreliable when set from JS in the same frame).
export function DrawnPortrait({
  sketchUrl,
  colorUrl,
  finalUrl,
  alt,
  inkMs = 5000,
  colorMs = 4000,
  className,
  onPhaseChange,
}: DrawnPortraitProps) {
  const svgHostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const penRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [phase, setPhase] = useState<DrawPhase>(sketchUrl ? 'loading' : 'done');
  const onPhaseRef = useRef(onPhaseChange);
  onPhaseRef.current = onPhaseChange;

  useEffect(() => {
    onPhaseRef.current?.(phase);
  }, [phase]);

  useEffect(() => {
    if (!sketchUrl) {
      setPhase('done');
      return;
    }
    let cancelled = false;
    setSvgMarkup(null);
    setPhase('loading');
    fetch(sketchUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setSvgMarkup(text);
      })
      .catch(() => {
        if (!cancelled) setPhase('done');
      });
    return () => {
      cancelled = true;
    };
  }, [sketchUrl]);

  // 1. Ink: strokes drawn one after another at a constant pen speed, pen tip following.
  useEffect(() => {
    if (!svgMarkup || !svgHostRef.current) return;
    const paths = Array.from(svgHostRef.current.querySelectorAll('path'));
    if (!paths.length) {
      setPhase('color');
      return;
    }

    const lengths = paths.map((p) => p.getTotalLength());
    const total = lengths.reduce((sum, l) => sum + l, 0);
    paths.forEach((p, i) => {
      p.style.strokeDasharray = `${lengths[i]} ${lengths[i]}`;
      p.style.strokeDashoffset = `${lengths[i]}`;
    });
    setPhase('ink');

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / inkMs);
      let remaining = t * total;
      let pen: { path: SVGPathElement; at: number } | null = null;

      for (let i = 0; i < paths.length; i++) {
        const drawn = Math.max(0, Math.min(lengths[i], remaining));
        paths[i].style.strokeDashoffset = `${lengths[i] - drawn}`;
        if (!pen && drawn > 0 && drawn < lengths[i]) pen = { path: paths[i], at: drawn };
        remaining -= lengths[i];
      }

      const penEl = penRef.current;
      if (penEl) {
        if (pen) {
          const point = pen.path.getPointAtLength(pen.at);
          penEl.style.opacity = '1';
          penEl.style.left = `${(point.x / VIEWBOX) * 100}%`;
          penEl.style.top = `${(point.y / VIEWBOX) * 100}%`;
        } else {
          penEl.style.opacity = '0';
        }
      }

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        if (penEl) penEl.style.opacity = '0';
        setPhase(colorUrl ? 'color' : 'frame');
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [svgMarkup, inkMs, colorUrl]);

  // 2. Colour: serpentine brush strokes painting the colour image in, under the ink lines.
  useEffect(() => {
    if (phase !== 'color' || !colorUrl) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      setPhase('frame');
      return;
    }

    let raf = 0;
    let cancelled = false;
    const image = new Image();
    image.onerror = () => !cancelled && setPhase('frame');
    image.onload = () => {
      if (cancelled) return;
      const size = image.naturalWidth || 1024;
      canvas.width = size;
      canvas.height = size;
      const pattern = ctx.createPattern(image, 'no-repeat');
      if (!pattern) {
        setPhase('frame');
        return;
      }

      const strokes = brushStrokes(size);
      const strokeLengths = strokes.map(polylineLength);
      const total = strokeLengths.reduce((sum, l) => sum + l, 0);
      const width = (size / BRUSH_ROWS) * 1.45;

      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / colorMs);
        let remaining = t * total;
        ctx.clearRect(0, 0, size, size);
        ctx.strokeStyle = pattern;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 0; i < strokes.length && remaining > 0; i++) {
          const partial = truncatePolyline(strokes[i], Math.min(remaining, strokeLengths[i]));
          // A main stroke plus two thinner offset "bristle" strokes for a painted edge.
          drawPolyline(ctx, partial, width, 0);
          drawPolyline(ctx, partial, width * 0.55, width * 0.38);
          drawPolyline(ctx, partial, width * 0.55, -width * 0.38);
          remaining -= strokeLengths[i];
        }

        if (t < 1) raf = requestAnimationFrame(tick);
        else setPhase('frame');
      };
      raf = requestAnimationFrame(tick);
    };
    image.src = colorUrl;

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase, colorUrl, colorMs]);

  // 3. Frame: fade in the final framed portrait.
  useEffect(() => {
    if (phase !== 'frame') return;
    const timeout = setTimeout(() => setPhase('done'), FRAME_MS);
    return () => clearTimeout(timeout);
  }, [phase]);

  const showFinal = phase === 'frame' || phase === 'done';

  return (
    <div className={`relative overflow-hidden bg-white ${className ?? ''}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {svgMarkup && (
        <div
          ref={svgHostRef}
          className="absolute inset-0 h-full w-full"
          // Traced SVG from our own SketchService (apps/api) — not user-supplied content.
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      )}
      <div
        ref={penRef}
        className="pointer-events-none absolute text-ink opacity-0 transition-opacity"
        style={{ transform: 'translate(-2px, -100%)' }}
        aria-hidden
      >
        <Pencil size={28} strokeWidth={2} className="drop-shadow" />
      </div>
      <img
        src={finalUrl}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: showFinal ? 1 : 0, transition: `opacity ${FRAME_MS}ms ease` }}
      />
    </div>
  );
}

type Point = [number, number];

// Serpentine rows (left→right, then right→left) with a little vertical wobble, like a
// painter filling the canvas; rows overlap so the whole image ends up covered.
function brushStrokes(size: number): Point[][] {
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

function polylineLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return length;
}

function truncatePolyline(points: Point[], length: number): Point[] {
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

function drawPolyline(ctx: CanvasRenderingContext2D, points: Point[], width: number, offsetY: number) {
  if (points.length < 2) return;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1] + offsetY);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1] + offsetY);
  ctx.stroke();
}
