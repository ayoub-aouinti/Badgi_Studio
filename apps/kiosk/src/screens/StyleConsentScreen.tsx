import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { StylePreset } from '@badgi-studio/shared';
import { api } from '../lib/api';
import { useKiosk } from '../state/kiosk-context';
import { StepHeader } from '../components/StepHeader';
import { StyleCard } from '../components/StyleCard';
import { ConsentCheckbox } from '../components/ConsentCheckbox';
import { Button } from '../components/Button';

const DESCRIPTION_KEYS: Record<StylePreset, string> = {
  pro: 'style.descriptionPro',
  caricature: 'style.descriptionCaricature',
  pencil: 'style.descriptionCrayon',
  painted: 'style.descriptionPainted',
  comic: 'style.descriptionComic',
};

export function StyleConsentScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, dispatch } = useKiosk();

  const [styleId, setStyleId] = useState<string | null>(state.styleId);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [wall, setWall] = useState(false);

  useEffect(() => {
    if (!state.participant) navigate('/entry', { replace: true });
  }, [state.participant, navigate]);

  const createSession = useMutation({
    mutationFn: api.createSession,
    onSuccess: ({ sessionId }) => {
      if (!styleId) return;
      dispatch({ type: 'SET_STYLE', styleId });
      dispatch({ type: 'SET_SESSION', sessionId });
      navigate('/capture');
    },
  });

  if (!state.participant) return null;

  const styles = state.config?.styles ?? [];
  const canSubmit = Boolean(styleId) && aiProcessing;

  return (
    <div className="kiosk-shell">
      <StepHeader current={2} total={3} />
      <h1 className="mb-4 text-2xl font-bold">{t('style.title')}</h1>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {styles.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            description={t(DESCRIPTION_KEYS[style.preset] ?? DESCRIPTION_KEYS.pro) ?? ''}
            selected={styleId === style.id}
            onSelect={() => setStyleId(style.id)}
          />
        ))}
      </div>

      <h2 className="mb-3 text-base font-bold">{t('style.consentTitle')}</h2>
      <div className="mb-4 flex flex-col gap-2">
        <ConsentCheckbox label={t('style.consentAi')} checked={aiProcessing} onChange={setAiProcessing} required />
        <ConsentCheckbox label={t('style.consentWall')} checked={wall} onChange={setWall} />
      </div>

      <p className="mb-6 text-xs text-ink-soft-2">{t('style.retentionNote')}</p>

      <div className="mt-auto">
        <Button
          disabled={!canSubmit || createSession.isPending}
          onClick={() =>
            styleId &&
            createSession.mutate({
              participantId: state.participant!.id,
              consents: { aiProcessing, wall },
            })
          }
        >
          {t('style.takePhoto')}
        </Button>
      </div>
    </div>
  );
}
