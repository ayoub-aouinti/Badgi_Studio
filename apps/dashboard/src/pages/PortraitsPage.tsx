import { useState } from 'react';
import type { AdminPortraitDto, UpdateAdminPortraitRequest } from '@badgi-studio/shared';
import { api } from '../lib/api';
import { useEvent, useEventData } from '../lib/event-context';
import { PortraitCard } from '../components/PortraitCard';

export function PortraitsPage() {
  const { event, refreshEvents, errorMessage } = useEvent();
  const { data: portraits, setData, error, setError } = useEventData((eventId) => api.getPortraits(eventId), 15000);
  const [pending, setPending] = useState<string | null>(null);

  async function update(portrait: AdminPortraitDto, dto: UpdateAdminPortraitRequest) {
    setPending(portrait.id);
    setError(null);
    try {
      const updated = await api.updatePortrait(event.id, portrait.id, dto);
      setData((list) => list?.map((p) => (p.id === updated.id ? updated : p)) ?? null);
      void refreshEvents();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  if (!portraits) return <p className="text-slate-500">{error ?? 'Chargement…'}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Portraits</h1>
        <span className="text-sm text-slate-500">{portraits.length} plus récents</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {portraits.length === 0 && <p className="text-slate-500">Aucun portrait pour le moment.</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {portraits.map((portrait) => (
          <PortraitCard key={portrait.id} portrait={portrait}>
            <WallControl portrait={portrait} busy={pending === portrait.id} onChange={(onWall) => update(portrait, { onWall })} />
          </PortraitCard>
        ))}
      </div>
    </div>
  );
}

function WallControl({
  portrait,
  busy,
  onChange,
}: {
  portrait: AdminPortraitDto;
  busy: boolean;
  onChange: (onWall: boolean) => void;
}) {
  if (portrait.purged || portrait.status !== 'READY') return null;
  if (portrait.onWall) {
    return (
      <button
        onClick={() => onChange(false)}
        disabled={busy}
        className="rounded-lg border border-red-200 py-1.5 text-sm font-semibold text-red-600 disabled:opacity-40"
      >
        Retirer du mur
      </button>
    );
  }
  if (!portrait.wallConsent) {
    return <p className="py-1.5 text-center text-xs text-slate-400">Pas de consentement mur</p>;
  }
  return (
    <button
      onClick={() => onChange(true)}
      disabled={busy}
      className="rounded-lg border border-slate-300 py-1.5 text-sm font-semibold disabled:opacity-40"
    >
      {portrait.moderation === 'PENDING' ? 'Approuver pour le mur' : 'Remettre sur le mur'}
    </button>
  );
}
