import { StudioStyle } from '@prisma/client';

export const AI_PROVIDER = 'AI_PROVIDER';

export interface GeneratedPortrait {
  image: Buffer;
  // true when the output is an illustration (flat colours, clear contours): the live-drawing
  // trace is then taken from it, like an artist inking their own drawing. For photo-like
  // output (retouched photo), the trace comes from the isolated selfie instead.
  illustration: boolean;
}

export interface AiProvider {
  generate(selfie: Buffer, style: StudioStyle): Promise<GeneratedPortrait>;
}
