import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useKiosk } from '../state/kiosk-context';
import { StepHeader } from '../components/StepHeader';
import { StyleCard } from '../components/StyleCard';
import { ConsentCheckbox } from '../components/ConsentCheckbox';
import { Button } from '../components/Button';

function descriptionKeyFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('caricature')) return 'style.descriptionCaricature';
  if (n.includes('peint')) return 'style.descriptionPeint';
  return 'style.descriptionPro';
}

export function StyleConsentScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, dispatch } = useKiosk();

  const [styleId, setStyleId] = useState<string | null>(state.styleId);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [wall, setWall] = useState(false);
  const [sponsor, setSponsor] = useState(false);

  useEffect(() => {
    if (!state.participant) navigate('/identify', { replace: true });
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
      <StepHeader current={3} total={4} />
      <h1 className="mb-4 text-2xl font-bold">{t('style.title')}</h1>

      <div className="mb-6 flex flex-col gap-3">
        {styles.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            description={t(descriptionKeyFor(style.name)) ?? ''}
            selected={styleId === style.id}
            onSelect={() => setStyleId(style.id)}
          />
        ))}
      </div>

      <h2 className="mb-3 text-base font-bold">{t('style.consentTitle')}</h2>
      <div className="mb-4 flex flex-col gap-2">
        <ConsentCheckbox label={t('style.consentAi')} checked={aiProcessing} onChange={setAiProcessing} required />
        <ConsentCheckbox label={t('style.consentWall')} checked={wall} onChange={setWall} />
        <ConsentCheckbox label={t('style.consentSponsor')} checked={sponsor} onChange={setSponsor} />
      </div>

      <p className="mb-6 text-xs text-ink-soft-2">{t('style.retentionNote')}</p>

      <div className="mt-auto">
        <Button
          disabled={!canSubmit || createSession.isPending}
          onClick={() =>
            styleId &&
            createSession.mutate({
              participantId: state.participant!.id,
              consents: { aiProcessing, wall, sponsor },
            })
          }
        >
          {t('style.takePhoto')}
        </Button>
      </div>
    </div>
  );
}
