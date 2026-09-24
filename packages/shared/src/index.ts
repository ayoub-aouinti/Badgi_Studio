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
}
