import { useState } from 'react';
import type { UpdateEventRequest } from '@badgi-studio/shared';
import { api, galleryLink, wallLink } from '../lib/api';
import { useEvent } from '../lib/event-context';

const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const fromDateInput = (value: string) => (value ? new Date(value).toISOString() : null);

export function SettingsPage() {
  const { event, refreshEvents, errorMessage } = useEvent();
  const [draft, setDraft] = useState({
    name: event.name,
    startsAt: toDateInput(event.startsAt),
    endsAt: toDateInput(event.endsAt),
    retentionDays: event.retentionDays,
    preModeration: event.preModeration,
    printEnabled: event.printEnabled,
    galleryEnabled: event.galleryEnabled,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmToken, setConfirmToken] = useState(false);
  const link = wallLink(event);

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      await refreshEvents();
      setStatus(okMessage);
    } catch (err) {
      setStatus(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const save = () => {
    const dto: UpdateEventRequest = {
      name: draft.name,
      startsAt: fromDateInput(draft.startsAt),
      endsAt: fromDateInput(draft.endsAt),
      retentionDays: draft.retentionDays,
      preModeration: draft.preModeration,
      printEnabled: draft.printEnabled,
      galleryEnabled: draft.galleryEnabled,
    };
    return run(() => api.updateEvent(event.id, dto), 'Paramètres enregistrés');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-bold">Événement</h2>
        <div>
          <label className="field-label">Nom</label>
          <input className="field-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Début</label>
            <input
              type="date"
              className="field-input"
              value={draft.startsAt}
              onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Fin</label>
            <input
              type="date"
              className="field-input"
              value={draft.endsAt}
              onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="field-label">Conservation des portraits (jours)</label>
          <input
            type="number"
            min={1}
            max={365}
            className="field-input w-32"
            value={draft.retentionDays}
            onChange={(e) => setDraft({ ...draft, retentionDays: Number(e.target.value) })}
          />
          <p className="mt-1 text-xs text-slate-500">
            S&apos;applique aux nouveaux portraits ; ensuite les fichiers sont supprimés et les contacts effacés.
          </p>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.preModeration}
            onChange={(e) => setDraft({ ...draft, preModeration: e.target.checked })}
          />
          <span>
            <span className="block font-semibold">Pré-modération du mur</span>
            <span className="text-sm text-slate-500">
              Chaque portrait attend votre approbation (onglet Modération) avant d&apos;apparaître sur le mur. Le
              participant reçoit son portrait dans tous les cas.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.printEnabled}
            onChange={(e) => setDraft({ ...draft, printEnabled: e.target.checked })}
          />
          <span>
            <span className="block font-semibold">Impression à la borne</span>
            <span className="text-sm text-slate-500">
              Affiche le bouton « Imprimer » (format photo 10×15). Une imprimante doit être configurée sur la tablette.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.galleryEnabled}
            onChange={(e) => setDraft({ ...draft, galleryEnabled: e.target.checked })}
          />
          <span>
            <span className="block font-semibold">Galerie en ligne</span>
            <span className="text-sm text-slate-500">
              Page publique avec les portraits du mur (participants ayant accepté l&apos;affichage), accessible par
              un lien secret.
            </span>
          </span>
        </label>
        <button
          onClick={save}
          disabled={busy}
          className="self-start rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          Enregistrer
        </button>
        {status && <p className="text-sm text-slate-600">{status}</p>}
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-bold">Mur en direct</h2>
        <p className="text-sm text-slate-500">Ouvrez ce lien en plein écran sur l&apos;écran TV du congrès.</p>
        <div className="flex gap-2">
          <input className="field-input font-mono text-xs" value={link} readOnly onFocus={(e) => e.target.select()} />
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            Ouvrir
          </a>
        </div>
        {event.galleryEnabled && (
          <div className="border-t border-slate-200 pt-4">
            <h3 className="mb-1 font-bold">Galerie en ligne</h3>
            <p className="mb-2 text-sm text-slate-500">À partager avec les participants (email, QR, réseaux).</p>
            <div className="flex gap-2">
              <input
                className="field-input font-mono text-xs"
                value={galleryLink(event)}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <a
                href={galleryLink(event)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              >
                Ouvrir
              </a>
            </div>
          </div>
        )}
        {confirmToken ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
            <p className="mb-2">L&apos;ancien lien cessera de fonctionner : l&apos;écran du mur devra ouvrir le nouveau.</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmToken(false);
                  void run(() => api.regenerateWallToken(event.id), 'Nouveau lien du mur généré');
                }}
                className="font-semibold text-red-700 underline"
              >
                Générer un nouveau lien
              </button>
              <button onClick={() => setConfirmToken(false)} className="text-slate-500 underline">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmToken(true)} className="self-start text-sm text-red-600 underline">
            Le lien a fuité ? Générer un nouveau lien
          </button>
        )}
      </section>
    </div>
  );
}
