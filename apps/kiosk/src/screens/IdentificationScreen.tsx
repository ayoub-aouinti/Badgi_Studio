import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { ScanLine, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';

export function IdentificationScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const badgeScanMutation = useMutation({
    mutationFn: api.badgeScan,
    onSuccess: (data) => {
      controlsRef.current?.stop();
      navigate('/identify/badge-confirm', { state: data });
    },
    onError: () => setScanError(t('common.error') ?? null),
  });

  useEffect(() => {
    const reader = new BrowserQRCodeReader();
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (result && !cancelled && !badgeScanMutation.isPending) {
          badgeScanMutation.mutate(result.getText());
        }
      })
      .then((controls) => {
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      })
      .catch(() => setScanError(null));

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="kiosk-shell">
      <StepHeader current={1} total={4} onBack={() => navigate('/')} />
      <h1 className="mb-6 text-2xl font-bold">{t('identify.title')}</h1>

      <div className="relative mb-6 overflow-hidden rounded-2xl border-2 border-teal bg-ink">
        <span className="absolute left-4 top-4 z-10 rounded-full bg-teal px-3 py-1 text-xs font-semibold text-white">
          {t('common.recommended')}
        </span>
        <video ref={videoRef} className="h-64 w-full scale-x-[-1] object-cover opacity-80" muted playsInline autoPlay />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-40 rounded-2xl border-2 border-dashed border-teal-vivid" />
        </div>
        <div className="flex items-center gap-2 bg-ink px-4 py-3 text-white">
          <ScanLine size={18} />
          <p className="text-sm font-semibold">{t('identify.scanCard')}</p>
        </div>
      </div>
      {scanError && <p className="mb-4 text-sm text-coral">{scanError}</p>}

      <div className="mb-6 flex items-center gap-3 text-ink-soft-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm">{t('common.or')}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button variant="secondary" icon={<UserRound size={20} />} onClick={() => navigate('/identify/manual')}>
        {t('identify.manualButton')}
      </Button>
    </div>
  );
}
