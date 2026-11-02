import { StudioStyle } from '@prisma/client';
import { AiProvider, GeneratedPortrait } from './ai-provider.interface';
import { failure, fetchWithTimeout, portraitPrompt, selfieForUpload, toGeneratedPortrait } from './remote-output';

export interface GeminiOptions {
  apiKey: string;
  model: string;
  costUsd: number;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
}

interface GeminiResponse {
  responseId?: string;
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

// AI_PROVIDER=gemini (paid): image editing with a Gemini image model through the
// Generative Language REST API (selfie and prompt in, edited image out).
export class GeminiAiProvider implements AiProvider {
  constructor(private readonly options: GeminiOptions) {}

  async generate(selfie: Buffer, style: StudioStyle): Promise<GeneratedPortrait> {
    const upload = await selfieForUpload(selfie);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.options.model)}:generateContent`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': this.options.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: portraitPrompt(style) },
              { inlineData: { mimeType: 'image/jpeg', data: upload.toString('base64') } },
            ],
          },
        ],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
    if (!res.ok) throw await failure('Gemini', res);

    const body = (await res.json()) as GeminiResponse;
    if (body.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the request: ${body.promptFeedback.blockReason}`);
    }
    const candidate = body.candidates?.[0];
    const data = candidate?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
    if (!data) throw new Error(`Gemini returned no image (finish reason: ${candidate?.finishReason ?? 'unknown'})`);

    return toGeneratedPortrait(Buffer.from(data, 'base64'), style, {
      providerRequestId: body.responseId,
      costUsd: this.options.costUsd,
    });
  }
}
