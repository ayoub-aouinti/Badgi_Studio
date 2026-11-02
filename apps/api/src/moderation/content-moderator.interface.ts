export const CONTENT_MODERATOR = 'CONTENT_MODERATOR';

export interface ModerationVerdict {
  flagged: boolean;
  // Short, organiser-facing reason stored on the portrait (dashboard moderation list).
  reason?: string;
}

// Automatic check of the selfie before any generation (docs/SPEC.md: status `moderating`).
export interface ContentModerator {
  check(image: Buffer): Promise<ModerationVerdict>;
}
