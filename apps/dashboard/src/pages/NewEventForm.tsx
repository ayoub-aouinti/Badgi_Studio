import { useState, type FormEvent } from 'react';
import type { AdminEventDto } from '@badgi-studio/shared';
import { api } from '../lib/api';

interface NewEventFormProps {
  canCancel: boolean;
  onCancel: () => void;
  onCreated: (event: AdminEventDto) => void | Promise<void>;
  errorMessage: (err: unknown) => string | null;
}

// Dates are optional: they are informative (dashboard), the studio runs whenever a kiosk is paired.
export function NewEventForm({ canCancel, onCancel, onCreated, errorMessage }: NewEventFormProps) {
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api.createEvent({
        name,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      });
      await onCreated(created);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-xl font-bold">Nouvel événement</h1>
      <p className="text-sm text-slate-500">
        L&apos;événement reçoit son propre mur, ses bornes, son branding et les 5 styles par défaut.
      </p>
      <div>
        <label className="field-label">Nom du congrès</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required minLength={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Début (facultatif)</label>
          <input type="date" className="field-input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Fin (facultatif)</label>
          <input type="date" className="field-input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          disabled={busy || name.trim().length < 2}
          className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Création…' : "Créer l'événement"}
        </button>
        {canCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-slate-500 underline">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
