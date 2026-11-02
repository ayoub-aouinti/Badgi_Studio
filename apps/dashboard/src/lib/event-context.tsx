import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AdminEventDto } from '@badgi-studio/shared';
import { UnauthorizedError } from './api';

interface EventContextValue {
  event: AdminEventDto;
  // Re-reads the event list (counts in the header, settings after a save).
  refreshEvents: () => Promise<void>;
  // Logs out on an expired session, otherwise returns the message to show.
  errorMessage: (err: unknown) => string | null;
}

export const EventContext = createContext<EventContextValue | null>(null);

export function useEvent(): EventContextValue {
  const value = useContext(EventContext);
  if (!value) throw new Error('useEvent outside of an event');
  return value;
}

// Loads data for the current event, reloads it when the event or `deps` (e.g. a search) change
// and, optionally, every `pollMs` (moderation queue, kiosk status). Errors go through the
// shared handler.
export function useEventData<T>(load: (eventId: string) => Promise<T>, pollMs?: number, deps: unknown[] = []) {
  const { event, errorMessage } = useEvent();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current(event.id));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, errorMessage, ...deps]);

  useEffect(() => {
    setData(null);
    void reload();
    if (!pollMs) return;
    const timer = setInterval(() => void reload(), pollMs);
    return () => clearInterval(timer);
  }, [reload, pollMs]);

  return { data, setData, error, setError, reload };
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof UnauthorizedError;
}
