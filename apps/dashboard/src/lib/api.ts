import type { BrandingDto } from '@badgi-studio/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
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

export interface AdminStyle {
  id: string;
  name: string;
  active: boolean;
}

export class UnauthorizedError extends Error {}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

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

  getBranding: async (): Promise<BrandingDto> => (await request('/admin/branding')).json(),

  updateBranding: async (dto: BrandingUpdate): Promise<BrandingDto> =>
    (await request('/admin/branding', { method: 'PUT', body: JSON.stringify(dto) })).json(),

  uploadLogo: async (file: File): Promise<BrandingDto> => {
    const form = new FormData();
    form.append('logo', file);
    return (await request('/admin/branding/logo', { method: 'POST', body: form })).json();
  },

  removeLogo: async (): Promise<BrandingDto> =>
    (await request('/admin/branding/logo', { method: 'DELETE' })).json(),

  // The preview endpoint needs the auth header, so it is fetched as a blob.
  previewUrl: async (): Promise<string> => {
    const blob = await (await request('/admin/branding/preview')).blob();
    return URL.createObjectURL(blob);
  },

  getStyles: async (): Promise<AdminStyle[]> => (await request('/admin/styles')).json(),

  setStyleActive: async (id: string, active: boolean): Promise<AdminStyle> =>
    (await request(`/admin/styles/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) })).json(),
};
