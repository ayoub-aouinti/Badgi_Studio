import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Camera, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useKiosk } from '../state/kiosk-context';
import { useCamera } from '../hooks/useCamera';
import { useCountdown } from '../hooks/useCountdown';

export function CaptureScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, dispatch } = useKiosk();
  const { videoRef, error: cameraError, captureFrame } = useCamera(true);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    if (!state.sessionId || !state.styleId) navigate('/style', { replace: true });
  }, [state.sessionId, state.styleId, navigate]);

  const createPortrait = useMutation({
    mutationFn: async () => {
      const blob = await captureFrame();
      if (!blob) throw new Error('capture failed');
      dispatch({ type: 'SET_SELFIE', url: URL.createObjectURL(blob) });
      return api.createPortrait(state.sessionId!, state.styleId!, blob);
    },
    onSuccess: ({ portraitId }) => {
      dispatch({ type: 'SET_PORTRAIT_ID', portraitId });
      navigate('/generating');
    },
    onError: () => setCounting(false),
  });

  const countdown = useCountdown(3, () => createPortrait.mutate(), counting);

  if (!state.sessionId || !state.styleId) return null;

  return (
    <div className="relative flex min-h-screen flex-col bg-ink text-white">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full scale-x-[-1] object-cover" muted playsInline autoPlay />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[70%] w-[55%] rounded-[50%] border-4 border-dashed border-white/70" />
        </div>
        {counting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-[8rem] font-extrabold text-white">{countdown}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-6 bg-ink px-8 py-8">
        {(cameraError || createPortrait.isError) && (
          <p className="text-center text-sm font-semibold text-coral">
            {cameraError ?? t('common.error')}
          </p>
        )}
        <p className="text-center text-lg font-semibold">{t('capture.instruction')}</p>
        <div className="flex w-full items-center justify-center gap-8">
          <button
            disabled
            className="flex flex-col items-center gap-1 text-white/40"
            title="V2"
          >
            <Users size={28} />
            <span className="text-xs">{t('capture.group')}</span>
          </button>
          <button
            onClick={() => !counting && !createPortrait.isPending && setCounting(true)}
            disabled={counting || createPortrait.isPending}
            aria-label={t('capture.shoot') ?? ''}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10 disabled:opacity-50"
          >
            <Camera size={32} />
          </button>
          <div className="w-[28px]" />
        </div>
      </div>
    </div>
  );
}
