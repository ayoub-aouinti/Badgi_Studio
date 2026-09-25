import { useEffect, useRef, useState } from 'react';

export function useCountdown(startFrom: number, onComplete: () => void, active = true): number {
  const [value, setValue] = useState(startFrom);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) return;
    setValue(startFrom);

    const interval = setInterval(() => {
      setValue((v) => {
        if (v <= 1) {
          clearInterval(interval);
          onCompleteRef.current();
          return 0;
        }
        return v - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startFrom, active]);

  return value;
}
