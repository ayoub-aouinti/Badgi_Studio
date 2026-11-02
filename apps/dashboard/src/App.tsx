import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AdminEventDto } from '@badgi-studio/shared';
import { api, clearToken, getToken } from './lib/api';
import { EventContext, isUnauthorized } from './lib/event-context';
import { StatsPage } from './pages/StatsPage';
import { ModerationPage } from './pages/ModerationPage';
import { PortraitsPage } from './pages/PortraitsPage';
import { ParticipantsPage } from './pages/ParticipantsPage';
import { KiosksPage } from './pages/KiosksPage';
import { BrandingPage } from './pages/BrandingPage';
import { SettingsPage } from './pages/SettingsPage';
import { NewEventForm } from './pages/NewEventForm';

type Page = 'stats' | 'moderation' | 'portraits' | 'participants' | 'kiosks' | 'branding' | 'settings';

const PAGES: { value: Page; label: string }[] = [
  { value: 'stats', label: 'Statistiques' },
  { value: 'moderation', label: 'Modération' },
  { value: 'portraits', label: 'Portraits' },
  { value: 'participants', label: 'Participants' },
  { value: 'kiosks', label: 'Bornes' },
  { value: 'branding', label: 'Branding & styles' },
  { value: 'settings', label: 'Paramètres' },
];

const EVENT_KEY = 'studio-admin-event';

export function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return (
    <Shell
      onLogout={() => {
        clearToken();
        setAuthed(false);
      }}
    />
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.login(password);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="card flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-xl font-bold">Portrait Studio — Admin</h1>
        <div>
          <label className="field-label">Mot de passe</label>
          <input
            type="password"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="rounded-lg bg-slate-900 py-2 font-semibold text-white">Connexion</button>
      </form>
    </div>
  );
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [events, setEvents] = useState<AdminEventDto[] | null>(null);
  const [eventId, setEventId] = useState<string | null>(() => localStorage.getItem(EVENT_KEY));
  const [page, setPage] = useState<Page>('stats');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorMessage = useCallback(
    (err: unknown) => {
      if (isUnauthorized(err)) {
        onLogout();
        return null;
      }
      return (err as Error).message;
    },
    [onLogout],
  );

  const refreshEvents = useCallback(async () => {
    try {
      setEvents(await api.getEvents());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [errorMessage]);

  useEffect(() => {
    void refreshEvents();
    // Keeps the moderation badge and counters current.
    const timer = setInterval(() => void refreshEvents(), 30000);
    return () => clearInterval(timer);
  }, [refreshEvents]);

  const selectEvent = (id: string) => {
    setEventId(id);
    localStorage.setItem(EVENT_KEY, id);
  };

  // Falls back to the most recent event when none (or an unknown one) is remembered.
  const event = events?.find((e) => e.id === eventId) ?? events?.[0] ?? null;
  const context = useMemo(
    () => (event ? { event, refreshEvents, errorMessage } : null),
    [event, refreshEvents, errorMessage],
  );

  if (!events) return <p className="p-8 text-slate-500">{error ?? 'Chargement…'}</p>;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {event && (
            <select
              className="max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold outline-none focus:border-slate-900"
              value={event.id}
              onChange={(e) => {
                selectEvent(e.target.value);
                setCreating(false);
              }}
              aria-label="Événement"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            + Nouvel événement
          </button>
        </div>
        <button onClick={onLogout} className="text-sm text-slate-500 underline">
          Déconnexion
        </button>
      </header>

      {creating || !context ? (
        <NewEventForm
          canCancel={Boolean(context)}
          onCancel={() => setCreating(false)}
          onCreated={async (created) => {
            await refreshEvents();
            selectEvent(created.id);
            setCreating(false);
            setPage('kiosks');
          }}
          errorMessage={errorMessage}
        />
      ) : (
        <EventContext.Provider value={context}>
          <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 pb-3">
            {PAGES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPage(p.value)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  page === p.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
                {p.value === 'moderation' && context.event.pendingCount > 0 && (
                  <span className="rounded-full bg-amber-500 px-2 text-xs text-white">{context.event.pendingCount}</span>
                )}
              </button>
            ))}
          </nav>
          {/* Keyed by event: every page starts from a clean state when switching events. */}
          <div key={context.event.id}>
            {page === 'stats' && <StatsPage />}
            {page === 'moderation' && <ModerationPage />}
            {page === 'portraits' && <PortraitsPage />}
            {page === 'participants' && <ParticipantsPage />}
            {page === 'kiosks' && <KiosksPage />}
            {page === 'branding' && <BrandingPage />}
            {page === 'settings' && <SettingsPage />}
          </div>
        </EventContext.Provider>
      )}
    </div>
  );
}
