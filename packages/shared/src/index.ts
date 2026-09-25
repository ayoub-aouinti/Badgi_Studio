// Shared types and DTOs for Badgi Studio apps (api, kiosk, wall, dashboard).

export type PortraitStatus =
  | 'QUEUED'
  | 'MODERATING'
  | 'GENERATING'
  | 'READY'
  | 'REJECTED'
  | 'FAILED';

export type PortraitProgressStep = 'sketch' | 'ink' | 'color' | 'frame';

export type ParticipantSource = 'BADGE' | 'MANUAL';

export interface ConsentInput {
  aiProcessing: boolean;
  wall: boolean;
  sponsor: boolean;
}

export interface KioskStyleDto {
  id: string;
  name: string;
  previewUrl?: string;
  sortOrder: number;
}

export interface KioskConfigDto {
  eventName: string;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  languages: string[];
  styles: KioskStyleDto[];
}

export interface ParticipantDto {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  whatsappE164?: string;
  specialty?: string;
  source: ParticipantSource;
}

// Socket.IO event names shared between apps/api, apps/kiosk and apps/wall.
export const WS_EVENTS = {
  PORTRAIT_PROGRESS: 'portrait.progress',
  PORTRAIT_READY: 'portrait.ready',
  WALL_NEW: 'wall.new',
  WALL_REMOVE: 'wall.remove',
} as const;

export interface PortraitProgressEvent {
  portraitId: string;
  sessionId: string;
  step: PortraitProgressStep;
}

export interface PortraitReadyEvent {
  portraitId: string;
  sessionId: string;
  publicCode: string;
  resultUrl: string;
  framedUrl: string;
  // Traced line-art SVG of the portrait, for a "drawing" reveal before showing the color
  // photo (docs/SCREENS.md écran 6b). Undefined if tracing failed — callers fall back to
  // showing the color image directly.
  sketchUrl?: string;
}

// Kiosk API request/response shapes (apps/kiosk <-> apps/api, see docs/SPEC.md §API).
export interface PairKioskResponse {
  kioskId: string;
  deviceToken: string;
}

export interface BadgeScanResponse {
  attendeeId: string;
  firstName: string;
  lastName: string;
  specialty?: string;
  emailMasked?: string;
  whatsappE164?: string;
}

export interface CreateParticipantRequest {
  firstName: string;
  lastName: string;
  email?: string;
  whatsappE164?: string;
  specialty?: string;
  attendeeId?: string;
}

export interface CreateParticipantResponse {
  participantId: string;
}

export interface CreateSessionRequest {
  participantId: string;
  consents: ConsentInput;
}

export interface CreateSessionResponse {
  sessionId: string;
}

export interface CreatePortraitResponse {
  portraitId: string;
}

// Wall API request/response shapes + WS events (apps/wall <-> apps/api).
export interface WallFeedPortraitDto {
  portraitId: string;
  framedUrl: string;
  sketchUrl?: string;
  participantName: string;
  specialty?: string;
  createdAt: string;
}

export interface WallFeedResponse {
  eventName: string;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  portraitCount: number;
  portraits: WallFeedPortraitDto[];
}

export interface WallNewEvent {
  portraitId: string;
  framedUrl: string;
  sketchUrl?: string;
  participantName: string;
  specialty?: string;
}

export interface WallRemoveEvent {
  portraitId: string;
}
