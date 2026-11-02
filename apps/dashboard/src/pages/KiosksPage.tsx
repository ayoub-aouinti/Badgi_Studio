import { useState, type FormEvent } from 'react';
import type { AdminKioskDto } from '@badgi-studio/shared';
import { api } from '../lib/api';
import { useEvent, useEventData } from '../lib/event-context';

const formatSeen = (iso?: string) => (iso ? new Date(iso).toLocaleString('fr-FR') : 'jamais');

export function KiosksPage() {
  const { event, refreshEvents, errorMessage } = useEvent();
  const { data: kiosks, setData, error, setError } = useEventData(api.getKiosks, 30000);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<{ kiosk: AdminKioskDto; action: 'reset' | 'remove' } | null>(null);

  async function act(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      await refreshEvents();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const create = (e: FormEvent) => {
    e.preventDefault();
    void act(async () => {
      const kiosk = await api.createKiosk(event.id, name);
      setData((list) => [...(list ?? []), kiosk]);
      setName('');
    });
  };

  const confirmAction = () => {
    if (!confirm) return;
    const { kiosk, action } = confirm;
    setConfirm(null);
    void act(async () => {
      if (action === 'reset') {
        const updated = await api.resetKiosk(event.id, kiosk.id);
        setData((list) => list?.map((k) => (k.id === updated.id ? updated : k)) ?? null);
      } else {
        await api.removeKiosk(event.id, kiosk.id);
        setData((list) => list?.filter((k) => k.id !== kiosk.id) ?? null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-3">
        <h2 className="text-lg font-bold">Ajouter une borne</h2>
        <p className="text-sm text-slate-500">
          Un code à 6 chiffres est créé : saisissez-le sur l&apos;écran d&apos;appairage de la tablette.
        </p>
        <form onSubmit={create} className="flex flex-wrap gap-2">
          <input
            className="field-input max-w-xs"
            placeholder="Ex. Borne Hall B"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            required
          />
          <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Créer</button>
        </form>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!kiosks ? (
        <p className="text-slate-500">Chargement…</p>
      ) : kiosks.length === 0 ? (
        <p className="text-slate-500">Aucune borne pour cet événement.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Borne</th>
                <th className="px-4 py-3 font-semibold">État</th>
                <th className="px-4 py-3 font-semibold">Code d&apos;appairage</th>
                <th className="px-4 py-3 font-semibold">Dernier contact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {kiosks.map((kiosk) => (
                <tr key={kiosk.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-semibold">{kiosk.name}</td>
                  <td className="px-4 py-3">
                    <KioskState kiosk={kiosk} />
                  </td>
                  <td className="px-4 py-3 font-mono text-base tracking-widest">{kiosk.pairingCode ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatSeen(kiosk.lastSeenAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      {kiosk.paired && (
                        <button onClick={() => setConfirm({ kiosk, action: 'reset' })} className="text-slate-600 underline">
                          Désappairer
                        </button>
                      )}
                      <button onClick={() => setConfirm({ kiosk, action: 'remove' })} className="text-red-600 underline">
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border border-red-200">
          <p className="text-sm">
            {confirm.action === 'reset'
              ? `« ${confirm.kiosk.name} » sera déconnectée et un nouveau code d'appairage sera créé.`
              : `Supprimer « ${confirm.kiosk.name} » ? Ses sessions et portraits seront supprimés aussi.`}
          </p>
          <div className="flex gap-3">
            <button onClick={confirmAction} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">
              Confirmer
            </button>
            <button onClick={() => setConfirm(null)} className="text-sm text-slate-500 underline">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KioskState({ kiosk }: { kiosk: AdminKioskDto }) {
  if (!kiosk.paired) return <span className="text-slate-500">○ En attente d&apos;appairage</span>;
  return kiosk.online ? (
    <span className="font-semibold text-emerald-700">● En ligne</span>
  ) : (
    <span className="text-slate-500">○ Hors ligne</span>
  );
}
