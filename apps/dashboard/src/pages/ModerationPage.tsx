import { useState } from 'react';
import type { AdminPortraitDto } from '@badgi-studio/shared';
import { api } from '../lib/api';
import { useEvent, useEventData } from '../lib/event-context';
import { PortraitCard } from '../components/PortraitCard';

// Queue of portraits waiting for the wall (pre-moderation) + selfies refused automatically.
export function ModerationPage() {
  const { event, refreshEvents, errorMessage } = useEvent();
  const queue = useEventData((eventId) => api.getPortraits(eventId, 'PENDING'), 10000);
  const refused = useEventData((eventId) => api.getPortraits(eventId, 'REJECTED'), 30000);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(portrait: AdminPortraitDto, moderation: 'APPROVED' | 'REJECTED') {
    setBusy(portrait.id);
    queue.setError(null);
    try {
      const updated = await api.updatePortrait(event.id, portrait.id, { moderation });
      queue.setData((list) => list?.filter((p) => p.id !== portrait.id) ?? null);
      if (moderation === 'REJECTED') refused.setData((list) => [updated, ...(list ?? [])]);
      void refreshEvents();
    } catch (err) {
      queue.setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">À modérer</h1>
          <p className="text-sm text-slate-500">
            {event.preModeration
              ? 'Pré-modération activée : les portraits attendent votre approbation avant le mur.'
              : 'Pré-modération désactivée (Paramètres) : les portraits vont directement sur le mur.'}
          </p>
        </div>
        {queue.error && <p className="text-sm text-red-600">{queue.error}</p>}
        {!queue.data ? (
          <p className="text-slate-500">Chargement…</p>
        ) : queue.data.length === 0 ? (
          <p className="text-slate-500">Rien à modérer.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {queue.data.map((portrait) => (
              <PortraitCard key={portrait.id} portrait={portrait}>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => decide(portrait, 'REJECTED')}
                    disabled={busy === portrait.id}
                    className="rounded-lg border border-red-200 py-1.5 text-sm font-semibold text-red-600 disabled:opacity-40"
                  >
                    Rejeter
                  </button>
                  <button
                    onClick={() => decide(portrait, 'APPROVED')}
                    disabled={busy === portrait.id}
                    className="rounded-lg bg-slate-900 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Approuver
                  </button>
                </div>
              </PortraitCard>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">Rejetés</h2>
          <p className="text-sm text-slate-500">
            Refusés automatiquement (selfie inapproprié, jamais généré) ou par vous (absents du mur, mais remis au
            participant).
          </p>
        </div>
        {refused.data && refused.data.length === 0 && <p className="text-slate-500">Aucun portrait rejeté.</p>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {refused.data?.map((portrait) => <PortraitCard key={portrait.id} portrait={portrait} />)}
        </div>
      </section>
    </div>
  );
}
