import type {
  AdminEventDto,
  AdminKioskDto,
  AdminParticipantDto,
  AdminPortraitDto,
  AdminStyleDto,
  BrandingDto,
  CreateEventRequest,
  EventStatsDto,
  ModerationStatus,
  PosterFormat,
  PosterJobDto,
  UpdateAdminPortraitRequest,
  UpdateEventRequest,
} from '@badgi-studio/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
// apps/wall base URL: the dashboard builds each event's wall link from it.
export const WALL_URL = import.meta.env.VITE_WALL_URL ?? 'http://localhost:5273';
const TOKEN_KEY = 'studio-admin-token';

export type BrandingUpdate = Partial<
  Pick<
    BrandingDto,
    | 'eventName'
    | 'tagline'
    | 'primaryColor'
    | 'accentColor'
    | 'frameStyle'
    | 'frameColor'
    | 'frameWidth'
    | 'showName'
    | 'showLogo'
  >
>;

export class UnauthorizedError extends Error {}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Public gallery page served by the API (/g/:galleryToken).
export function galleryLink(event: AdminEventDto): string {
  return `${API_URL.replace(/\/+$/, '')}/g/${event.galleryToken}`;
}

export function wallLink(event: AdminEventDto): string {
  return `${WALL_URL.replace(/\/+$/, '')}/?token=${encodeURIComponent(event.wallToken)}`;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    throw new UnauthorizedError('Session expirée');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? res.statusText));
  }
  return res;
}

const json = async <T>(path: string, init?: RequestInit): Promise<T> => (await request(path, init)).json();
const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});
const ev = (eventId: string) => `/admin/events/${eventId}`;

export const api = {
  async login(password: string) {
    const res = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error('Mot de passe incorrect');
    const { token } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);
  },

  // --- Events ---
  getEvents: () => json<AdminEventDto[]>('/admin/events'),
  createEvent: (dto: CreateEventRequest) => json<AdminEventDto>('/admin/events', send('POST', dto)),
  updateEvent: (eventId: string, dto: UpdateEventRequest) => json<AdminEventDto>(ev(eventId), send('PATCH', dto)),
  regenerateWallToken: (eventId: string) => json<AdminEventDto>(`${ev(eventId)}/wall-token`, send('POST')),
  getStats: (eventId: string) => json<EventStatsDto>(`${ev(eventId)}/stats`),

  // --- Branding & styles ---
  getBranding: (eventId: string) => json<BrandingDto>(`${ev(eventId)}/branding`),
  updateBranding: (eventId: string, dto: BrandingUpdate) => json<BrandingDto>(`${ev(eventId)}/branding`, send('PUT', dto)),
  uploadLogo: (eventId: string, file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return json<BrandingDto>(`${ev(eventId)}/branding/logo`, { method: 'POST', body: form });
  },
  removeLogo: (eventId: string) => json<BrandingDto>(`${ev(eventId)}/branding/logo`, send('DELETE')),
  // The preview endpoint needs the auth header, so it is fetched as a blob.
  previewUrl: async (eventId: string): Promise<string> => {
    const blob = await (await request(`${ev(eventId)}/branding/preview`)).blob();
    return URL.createObjectURL(blob);
  },
  getStyles: (eventId: string) => json<AdminStyleDto[]>(`${ev(eventId)}/styles`),
  setStyleActive: (eventId: string, id: string, active: boolean) =>
    json<AdminStyleDto>(`${ev(eventId)}/styles/${id}`, send('PATCH', { active })),

  // --- Portraits & moderation ---
  getPortraits: (eventId: string, moderation?: ModerationStatus) =>
    json<AdminPortraitDto[]>(`${ev(eventId)}/portraits${moderation ? `?moderation=${moderation}` : ''}`),
  updatePortrait: (eventId: string, id: string, dto: UpdateAdminPortraitRequest) =>
    json<AdminPortraitDto>(`${ev(eventId)}/portraits/${id}`, send('PATCH', dto)),

  // The ZIP needs the auth header: fetched as a blob, then saved through an object URL.
  downloadPortraitsZip: async (eventId: string): Promise<Blob> => (await request(`${ev(eventId)}/portraits.zip`)).blob(),

  // --- Poster ---
  createPoster: (eventId: string, format: PosterFormat) => json<PosterJobDto>(`${ev(eventId)}/poster`, send('POST', { format })),
  getPoster: (eventId: string, jobId: string) => json<PosterJobDto>(`${ev(eventId)}/poster/${jobId}`),

  // --- Kiosks ---
  getKiosks: (eventId: string) => json<AdminKioskDto[]>(`${ev(eventId)}/kiosks`),
  createKiosk: (eventId: string, name: string) => json<AdminKioskDto>(`${ev(eventId)}/kiosks`, send('POST', { name })),
  resetKiosk: (eventId: string, id: string) => json<AdminKioskDto>(`${ev(eventId)}/kiosks/${id}/reset`, send('POST')),
  removeKiosk: async (eventId: string, id: string) => {
    await request(`${ev(eventId)}/kiosks/${id}`, send('DELETE'));
  },

  // --- Participants ---
  getParticipants: (eventId: string, q?: string) =>
    json<AdminParticipantDto[]>(`${ev(eventId)}/participants${q ? `?q=${encodeURIComponent(q)}` : ''}`),
};
