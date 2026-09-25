import { useEffect, useRef, useState } from 'react';

export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return;

    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 1280, height: 1280 }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setReady(true);
      })
      .catch((err: Error) => setError(err.message));

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      setReady(false);
    };
  }, [active]);

  function captureFrame(): Promise<Blob | null> {
    const video = videoRef.current;
    if (!video) return Promise.resolve(null);

    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);

    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9));
  }

  return { videoRef, error, ready, captureFrame };
}
