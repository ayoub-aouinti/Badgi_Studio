import { StudioStyle } from '@prisma/client';
import { AiProvider, GeneratedPortrait } from './ai-provider.interface';
import { failure, fetchWithTimeout, portraitPrompt, selfieForUpload, toGeneratedPortrait } from './remote-output';

export interface FalOptions {
  apiKey: string;
  // docs/SPEC.md: FLUX.1 Kontext [pro], $0.04 per image.
  model: string;
  costUsd: number;
}

interface FalResponse {
  images?: { url: string }[];
  has_nsfw_concepts?: boolean[];
}

// AI_PROVIDER=fal (paid): image editing with fal.ai's synchronous endpoint. The selfie is
// sent inline as a data URI, so nothing has to be publicly hosted.
export class FalAiProvider implements AiProvider {
  constructor(private readonly options: FalOptions) {}

  async generate(selfie: Buffer, style: StudioStyle): Promise<GeneratedPortrait> {
    const upload = await selfieForUpload(selfie);
    const res = await fetchWithTimeout(`https://fal.run/${this.options.model}`, {
      method: 'POST',
      headers: { Authorization: `Key ${this.options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: portraitPrompt(style),
        image_url: `data:image/jpeg;base64,${upload.toString('base64')}`,
        aspect_ratio: '1:1',
        output_format: 'jpeg',
        num_images: 1,
      }),
    });
    if (!res.ok) throw await failure('fal.ai', res);

    const body = (await res.json()) as FalResponse;
    const url = body.images?.[0]?.url;
    if (!url) throw new Error('fal.ai returned no image');
    if (body.has_nsfw_concepts?.[0]) throw new Error('fal.ai flagged the generated image');

    const image = await fetchWithTimeout(url);
    if (!image.ok) throw await failure('fal.ai image download', image);

    return toGeneratedPortrait(Buffer.from(await image.arrayBuffer()), style, {
      providerRequestId: res.headers.get('x-fal-request-id') ?? undefined,
      costUsd: this.options.costUsd,
    });
  }
}
