import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { PortraitProgressEvent, PortraitProgressStep, PortraitReadyEvent } from '@badgi-studio/shared';
import { WS_EVENTS } from '@badgi-studio/shared';
import { joinSessionRoom, onEvent } from '../lib/socket';
import { useKiosk } from '../state/kiosk-context';
import { ProgressSteps } from '../components/ProgressSteps';
import { SponsorBadge } from '../components/SponsorBadge';
import { DrawnPortrait } from '../components/DrawnPortrait';

const STEP_ORDER: PortraitProgressStep[] = ['sketch', 'ink', 'color', 'frame'];
const GENERATION_TIMEOUT_MS = 45000;
const DRAW_DURATION_MS = 3200;

export function GenerationScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, dispatch } = useKiosk();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!state.sessionId || !state.portraitId) {
      navigate('/', { replace: true });
      return;
    }

    joinSessionRoom(state.sessionId);
    timeoutRef.current = setTimeout(() => setTimedOut(true), GENERATION_TIMEOUT_MS);

    const offProgress = onEvent<PortraitProgressEvent>(WS_EVENTS.PORTRAIT_PROGRESS, (event) => {
      if (event.portraitId !== state.portraitId) return;
      setActiveIndex(STEP_ORDER.indexOf(event.step));
    });

    const offReady = onEvent<PortraitReadyEvent>(WS_EVENTS.PORTRAIT_READY, (event) => {
      if (event.portraitId !== state.portraitId) return;
      clearTimeout(timeoutRef.current);
      dispatch({
        type: 'SET_PORTRAIT_RESULT',
        result: {
          publicCode: event.publicCode,
          resultUrl: event.resultUrl,
          framedUrl: event.framedUrl,
          sketchUrl: event.sketchUrl,
        },
      });
      // Let the drawing animation play out before moving on to the result screen.
      setTimeout(() => navigate('/result'), DRAW_DURATION_MS + 800);
    });

    return () => {
      clearTimeout(timeoutRef.current);
      offProgress();
      offReady();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessionId, state.portraitId]);

  if (!state.sessionId || !state.portraitId) return null;

  const steps = STEP_ORDER.map((key) => ({ key, label: t(`generation.step${capitalize(key)}`) ?? key }));
  const isLive = activeIndex >= 0;

  if (timedOut) {
    return (
      <div className="kiosk-shell items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold text-coral">{t('generation.timeoutError')}</p>
        <button
          onClick={() => {
            dispatch({ type: 'RESET_FLOW' });
            navigate('/');
          }}
          className="text-sm font-semibold text-ink-soft underline"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="kiosk-shell items-center gap-8">
      <div className="relative w-full overflow-hidden rounded-2xl bg-white shadow-sm">
        {isLive && (
          <span className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-full bg-coral px-3 py-1 text-xs font-bold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            {t('generation.live')}
          </span>
        )}
        {state.portraitResult ? (
          <DrawnPortrait
            sketchUrl={state.portraitResult.sketchUrl}
            colorUrl={state.portraitResult.framedUrl}
            alt=""
            durationMs={DRAW_DURATION_MS}
            className="aspect-square w-full"
          />
        ) : (
          state.selfiePreviewUrl && (
            <img src={state.selfiePreviewUrl} alt="" className="aspect-square w-full object-cover" />
          )
        )}
      </div>

      <h1 className="text-center text-xl font-bold">
        {isLive ? t('generation.liveTitle') : t('generation.title')}
      </h1>

      <ProgressSteps steps={steps} activeIndex={state.portraitResult ? steps.length : activeIndex} />

      <div className="mt-auto w-full">
        <SponsorBadge sponsorName={state.config?.sponsorName} sponsorLogoUrl={state.config?.sponsorLogoUrl} dark />
      </div>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
