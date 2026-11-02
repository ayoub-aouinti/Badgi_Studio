import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useEventData } from '../lib/event-context';

export function ParticipantsPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const { data: participants, error } = useEventData((eventId) => api.getParticipants(eventId, search), undefined, [search]);

  // Debounced: searching runs once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Participants</h1>
        <input
          className="field-input max-w-xs"
          placeholder="Rechercher (nom, email)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="text-xs text-slate-500">
        Les emails et numéros WhatsApp sont effacés automatiquement à la fin de la durée de conservation.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!participants ? (
        <p className="text-slate-500">Chargement…</p>
      ) : participants.length === 0 ? (
        <p className="text-slate-500">Aucun participant{search ? ' trouvé' : ' pour le moment'}.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Nom</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">WhatsApp</th>
                <th className="px-4 py-3 text-right font-semibold">Portraits</th>
                <th className="px-4 py-3 font-semibold">Mur</th>
                <th className="px-4 py-3 font-semibold">Inscription</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-semibold">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-4 py-3">{p.email ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3">{p.whatsappE164 ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.portraitCount}</td>
                  <td className="px-4 py-3">{p.wallConsent ? 'Accepté' : <span className="text-slate-400">Refusé</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(p.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
