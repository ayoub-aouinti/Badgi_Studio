import { StudioStyle } from '@prisma/client';
import sharp from 'sharp';
import { GeneratedPortrait } from './ai-provider.interface';
import { stylePreset } from './mock-ai.provider';

const OUTPUT_SIZE = 1024;
const REQUEST_TIMEOUT_MS = 120_000;

// Appended to every style prompt sent to a paid image model: the portrait must still be the
// participant, and a plain square framing keeps the frame and the live drawing consistent.
const PROMPT_SUFFIX =
  'Keep the person clearly recognisable: same face shape, hairstyle, facial hair, glasses and skin tone. ' +
  'Head and shoulders, centred, square format, plain light background, no text.';

export function portraitPrompt(style: StudioStyle): string {
  return `${style.prompt.trim()} ${PROMPT_SUFFIX}`;
}

export async function selfieForUpload(selfie: Buffer): Promise<Buffer> {
  return sharp(selfie).rotate().resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
}

export function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

export async function failure(provider: string, res: Response): Promise<Error> {
  const body = await res.text().catch(() => '');
  return new Error(`${provider} request failed: HTTP ${res.status} ${body.slice(0, 300)}`);
}

// Generated images come back at the model's own size and framing: normalised to the 1024px
// square every other step expects. Flat-colour presets are traced directly; photo-like ones
// (pro, pencil) are traced from the output itself, since it no longer matches the selfie.
export async function toGeneratedPortrait(
  image: Buffer,
  style: StudioStyle,
  meta: { providerRequestId?: string; costUsd?: number },
): Promise<GeneratedPortrait> {
  const square = await sharp(image)
    .rotate()
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover' })
    .removeAlpha()
    .jpeg({ quality: 92 })
    .toBuffer();
  const preset = stylePreset(style);
  const illustration = preset === 'caricature' || preset === 'painted' || preset === 'comic';
  return {
    image: square,
    illustration,
    lineArtSource: illustration ? undefined : square,
    ...meta,
  };
}
