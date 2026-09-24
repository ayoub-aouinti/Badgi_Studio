import { StudioStyle } from '@prisma/client';

export const AI_PROVIDER = 'AI_PROVIDER';

export interface AiProvider {
  generate(selfie: Buffer, style: StudioStyle): Promise<Buffer>;
}
