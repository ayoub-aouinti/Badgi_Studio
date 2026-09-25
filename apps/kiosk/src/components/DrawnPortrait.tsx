import { useEffect, useRef, useState } from 'react';

interface DrawnPortraitProps {
  sketchUrl?: string;
  colorUrl: string;
  alt: string;
  durationMs?: number;
  className?: string;
}

// Renders the traced SVG (apps/api SketchService) and animates each path's stroke from
// fully hidden to fully drawn (stroke-dasharray/stroke-dashoffset) — a real "someone is
// drawing this" effect — then crossfades to the actual color photo. Same component as
// apps/wall/src/components/DrawnPortrait.tsx; not shared since each frontend app is
// independent (docs/CLAUDE.md monorepo layout has no shared UI package).
export function DrawnPortrait({ sketchUrl, colorUrl, alt, durationMs = 3200, className }: DrawnPortraitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(!sketchUrl);

  useEffect(() => {
    if (!sketchUrl) {
      setRevealed(true);
      return;
    }

    let cancelled = false;
    setSvgMarkup(null);
    setRevealed(false);

    fetch(sketchUrl)
      .then((res) => res.text())
      .then((text) => {
        if (!cancelled) setSvgMarkup(text);
      })
      .catch(() => {
        if (!cancelled) setRevealed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [sketchUrl]);

  useEffect(() => {
    if (!svgMarkup || !containerRef.current) return;

    const paths = Array.from(containerRef.current.querySelectorAll('path'));
    if (!paths.length) {
      setRevealed(true);
      return;
    }

    // Set the "hidden" state with no transition first.
    paths.forEach((path) => {
      const length = path.getTotalLength();
      path.style.transition = 'none';
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
    });

    // A single forced reflow is not reliable here (the browser can coalesce both style
    // writes into one frame and skip straight to the end state). Two nested rAFs guarantee
    // the "hidden" state is actually painted at least once before the transition to 0 is
    // requested, which is the robust way to animate stroke-dashoffset from JS.
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        paths.forEach((path) => {
          path.style.transition = `stroke-dashoffset ${durationMs}ms ease-in-out`;
          path.style.strokeDashoffset = '0';
        });
      });
    });

    const timeout = setTimeout(() => setRevealed(true), durationMs + 300);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timeout);
    };
  }, [svgMarkup, durationMs]);

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {svgMarkup && (
        <div
          ref={containerRef}
          className="absolute inset-0 h-full w-full bg-white"
          style={{ opacity: revealed ? 0 : 1, transition: 'opacity 0.6s ease' }}
          // Traced SVG from our own SketchService (apps/api) — not user-supplied content.
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      )}
      <img
        src={colorUrl}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: revealed ? 1 : 0, transition: 'opacity 0.8s ease' }}
      />
    </div>
  );
}
