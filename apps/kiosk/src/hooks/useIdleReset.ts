import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

// docs/SPEC.md: reset the kiosk after 60s of inactivity (or a custom delay, e.g. 20s on Result).
export function useIdleReset(timeoutMs: number, onIdle: () => void, enabled = true) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    reset();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset));

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [timeoutMs, enabled]);
}
