import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import type { BadgeScanResponse } from '@badgi-studio/shared';
import { api } from '../lib/api';
import { useKiosk } from '../state/kiosk-context';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';

export function BadgeConfirmScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useKiosk();
  const badge = location.state as BadgeScanResponse | null;

  const [whatsapp, setWhatsapp] = useState(badge?.whatsappE164 ?? '');

  useEffect(() => {
    if (!badge) navigate('/identify', { replace: true });
  }, [badge, navigate]);

  const createParticipant = useMutation({
    mutationFn: api.createParticipant,
    onSuccess: ({ participantId }) => {
      if (!badge) return;
      dispatch({
        type: 'SET_PARTICIPANT',
        participant: { id: participantId, firstName: badge.firstName, lastName: badge.lastName },
      });
      navigate('/style');
    },
  });

  if (!badge) return null;

  return (
    <div className="kiosk-shell">
      <StepHeader current={1} total={4} onBack={() => navigate('/identify')} />

      <div className="mb-6 flex items-center gap-2 rounded-xl bg-teal-light px-4 py-3 text-teal">
        <BadgeCheck size={20} />
        <span className="font-semibold">{t('badge.recognized')}</span>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('badge.greeting', { firstName: badge.firstName })}</h1>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border-soft bg-white p-4">
        <Row label={t('badge.name')} value={`${badge.firstName} ${badge.lastName}`} />
        {badge.specialty && <Row label={t('badge.specialty')} value={badge.specialty} />}
        {badge.emailMasked && (
          <Row label={t('badge.email')} value={badge.emailMasked} tag={t('badge.badgeLabel') ?? undefined} />
        )}
      </div>

      <div className="mb-8">
        <label className="mb-1 block text-sm font-semibold text-ink-soft">{t('manual.whatsapp')}</label>
        <div className="flex overflow-hidden rounded-xl border border-border bg-white">
          <span className="flex items-center bg-border-soft px-3 text-sm font-semibold text-ink-soft">+216</span>
          <input
            value={whatsapp.replace('+216', '')}
            onChange={(e) => setWhatsapp(`+216${e.target.value.replace(/\D/g, '').slice(0, 8)}`)}
            inputMode="numeric"
            className="flex-1 px-3 py-3 outline-none"
          />
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <Button
          onClick={() =>
            createParticipant.mutate({
              attendeeId: badge.attendeeId,
              firstName: badge.firstName,
              lastName: badge.lastName,
              specialty: badge.specialty,
              whatsappE164: whatsapp || undefined,
            })
          }
          disabled={createParticipant.isPending}
        >
          {t('badge.confirm')}
        </Button>
        <button onClick={() => navigate('/identify')} className="text-sm font-semibold text-ink-soft underline">
          {t('badge.notMe')}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, tag }: { label: string; value: string; tag?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-soft-2">{label}</span>
      <span className="flex items-center gap-2 font-semibold text-ink">
        {value}
        {tag && <span className="rounded-full bg-border-soft px-2 py-0.5 text-[10px] text-ink-soft-2">{tag}</span>}
      </span>
    </div>
  );
}
