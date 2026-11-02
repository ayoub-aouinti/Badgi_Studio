// Shared types and DTOs for Portrait Studio apps (api, kiosk, wall, dashboard).

export type PortraitStatus =
  | 'QUEUED'
  | 'MODERATING'
  | 'GENERATING'
  | 'READY'
  | 'REJECTED'
  | 'FAILED';

export type PortraitProgressStep = 'sketch' | 'ink' | 'color' | 'frame';

// Wall moderation (portraits.moderation), separate from the generation status.
export type ModerationStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ConsentInput {
  aiProcessing: boolean;
  wall: boolean;
}

// Rendering recipe of a style (studio_styles.preset): drives the local providers and the
// style card look on the kiosk; paid providers (fal/gemini) follow the style prompt instead.
export const STYLE_PRESETS = ['pro', 'caricature', 'pencil', 'painted', 'comic'] as const;
export type StylePreset = (typeof STYLE_PRESETS)[number];

export interface KioskStyleDto {
  id: string;
  name: string;
  preset: StylePreset;
  previewUrl?: string;
  sortOrder: number;
}

export type FrameStyle = 'none' | 'banner' | 'border' | 'polaroid';

// Branding edited in the admin space; applied to the kiosk, the wall and the portrait frame.
export interface BrandingDto {
  eventName: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  frameStyle: FrameStyle;
  frameColor: string;
  frameWidth: number;
  showName: boolean;
  showLogo: boolean;
}

export interface KioskConfigDto {
  branding: BrandingDto;
  languages: string[];
  styles: KioskStyleDto[];
}

export interface ParticipantDto {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  whatsappE164?: string;
}

// Socket.IO event names shared between apps/api, apps/kiosk and apps/wall.
export const WS_EVENTS = {
  PORTRAIT_PROGRESS: 'portrait.progress',
  PORTRAIT_READY: 'portrait.ready',
  WALL_NEW: 'wall.new',
  WALL_REMOVE: 'wall.remove',
  // The selfie was refused by automatic moderation: no portrait is generated.
  PORTRAIT_REJECTED: 'portrait.rejected',
} as const;

export interface PortraitRejectedEvent {
  portraitId: string;
  sessionId: string;
}

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

export interface CreateParticipantRequest {
  firstName: string;
  lastName: string;
  email?: string;
  whatsappE164?: string;
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
  // Unframed AI result, painted in with brush strokes after the ink pass.
  resultUrl?: string;
  sketchUrl?: string;
  participantName: string;
  createdAt: string;
}

export interface WallFeedResponse {
  branding: BrandingDto;
  portraitCount: number;
  portraits: WallFeedPortraitDto[];
}

export interface WallNewEvent {
  portraitId: string;
  framedUrl: string;
  resultUrl?: string;
  sketchUrl?: string;
  participantName: string;
}

export interface WallRemoveEvent {
  portraitId: string;
}

// Admin space (apps/dashboard <-> apps/api /admin/portraits).
export interface AdminPortraitDto {
  id: string;
  publicCode: string;
  status: PortraitStatus;
  participantName: string;
  styleName: string;
  // Framed portrait; undefined until ready, and again once purged.
  imageUrl?: string;
  onWall: boolean;
  pinned: boolean;
  // Only a participant who consented can be (re)shown on the wall.
  wallConsent: boolean;
  moderation: ModerationStatus;
  moderationReason?: string;
  createdAt: string;
  purgeAt: string;
  purged: boolean;
}

export interface UpdateAdminPortraitRequest {
  onWall?: boolean;
  pinned?: boolean;
  // Organiser decision for the wall; APPROVED also puts the portrait on the wall.
  moderation?: 'APPROVED' | 'REJECTED';
}

export interface AdminStyleDto {
  id: string;
  name: string;
  preset: StylePreset;
  active: boolean;
}

export interface AdminEventDto {
  id: string;
  name: string;
  slug: string;
  startsAt?: string;
  endsAt?: string;
  enabled: boolean;
  retentionDays: number;
  preModeration: boolean;
  // Secret in the wall screen URL (apps/wall ?token=...).
  wallToken: string;
  portraitCount: number;
  pendingCount: number;
  kioskCount: number;
}

export interface CreateEventRequest {
  name: string;
  startsAt?: string;
  endsAt?: string;
}

export interface UpdateEventRequest {
  name?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  enabled?: boolean;
  retentionDays?: number;
  preModeration?: boolean;
}

export interface AdminKioskDto {
  id: string;
  name: string;
  // Shown until a tablet is paired with it (the kiosk app's pairing screen).
  pairingCode?: string;
  paired: boolean;
  online: boolean;
  lastSeenAt?: string;
}

export interface CreateKioskRequest {
  name: string;
}

export interface AdminParticipantDto {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  whatsappE164?: string;
  createdAt: string;
  portraitCount: number;
  wallConsent: boolean;
}

export interface EventStatsDto {
  participants: number;
  portraitsReady: number;
  portraitsFailed: number;
  autoRejected: number;
  pendingModeration: number;
  onWall: number;
  emailsSent: number;
  emailsFailed: number;
  aiCostUsd: number;
  kiosksOnline: number;
  kiosksTotal: number;
  byStyle: { styleId: string; name: string; preset: StylePreset; count: number }[];
  // Ready portraits per hour (ISO start of the hour), oldest first.
  byHour: { hour: string; count: number }[];
}
