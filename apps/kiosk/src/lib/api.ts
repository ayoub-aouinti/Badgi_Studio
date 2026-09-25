import type {
  BadgeScanResponse,
  CreateParticipantRequest,
  CreateParticipantResponse,
  CreatePortraitResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  KioskConfigDto,
  PairKioskResponse,
} from '@badgi-studio/shared';

export const API_URL = import.meta.env.VITE_API_URL;
const DEVICE_TOKEN_KEY = 'badgi-kiosk-device-token';

export function getDeviceToken(): string | null {
  return localStorage.getItem(DEVICE_TOKEN_KEY);
}

export function setDeviceToken(token: string) {
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
}

export function clearDeviceToken() {
  localStorage.removeItem(DEVICE_TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getDeviceToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    if (res.status === 401) clearDeviceToken();
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  pair: (pairingCode: string) =>
    request<PairKioskResponse>('/kiosk/pair', {
      method: 'POST',
      body: JSON.stringify({ pairingCode }),
    }),

  getConfig: () => request<KioskConfigDto>('/kiosk/config'),

  badgeScan: (token: string) =>
    request<BadgeScanResponse>('/kiosk/badge-scan', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  createParticipant: (dto: CreateParticipantRequest) =>
    request<CreateParticipantResponse>('/kiosk/participants', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  createSession: (dto: CreateSessionRequest) =>
    request<CreateSessionResponse>('/kiosk/sessions', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  createPortrait: (sessionId: string, styleId: string, selfie: Blob) => {
    const form = new FormData();
    form.append('styleId', styleId);
    form.append('selfie', selfie, 'selfie.jpg');
    return request<CreatePortraitResponse>(`/kiosk/sessions/${sessionId}/portraits`, {
      method: 'POST',
      body: form,
    });
  },
};
