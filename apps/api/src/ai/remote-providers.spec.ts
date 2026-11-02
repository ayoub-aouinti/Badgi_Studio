import sharp from 'sharp';
import { StudioStyle } from '@prisma/client';
import { FalAiProvider } from './fal-ai.provider';
import { GeminiAiProvider } from './gemini-ai.provider';

function style(preset: string): StudioStyle {
  return {
    id: 'style-1',
    configId: 'config-1',
    name: preset,
    preset,
    prompt: 'Turn this selfie into a caricature.',
    model: 'fal',
    previewKey: null,
    sortOrder: 0,
    active: true,
  };
}

const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 90 } } }).jpeg().toBuffer();

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ...headers } });
}

jest.setTimeout(20000);

describe('paid AI providers', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('FalAiProvider', () => {
    const provider = new FalAiProvider({ apiKey: 'fal-key', model: 'fal-ai/flux-pro/kontext', costUsd: 0.04 });

    it('sends the style prompt and the selfie, and returns a square 1024 portrait with its cost', async () => {
      const generated = await image(768, 1024);
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ images: [{ url: 'https://cdn.fal/out.jpg' }] }, { 'x-fal-request-id': 'req-1' }))
        .mockResolvedValueOnce(new Response(generated));

      const result = await provider.generate(await image(64, 64), style('caricature'));

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://fal.run/fal-ai/flux-pro/kontext');
      expect(init.headers.Authorization).toBe('Key fal-key');
      const body = JSON.parse(init.body);
      expect(body.prompt).toContain('Turn this selfie into a caricature.');
      expect(body.image_url).toMatch(/^data:image\/jpeg;base64,/);

      const meta = await sharp(result.image).metadata();
      expect([meta.width, meta.height]).toEqual([1024, 1024]);
      expect(result).toEqual(
        expect.objectContaining({ illustration: true, providerRequestId: 'req-1', costUsd: 0.04 }),
      );
    });

    it('traces photo-like presets from the generated image itself', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ images: [{ url: 'https://cdn.fal/out.jpg' }] }))
        .mockResolvedValueOnce(new Response(await image(512, 512)));

      const result = await provider.generate(await image(64, 64), style('pro'));

      expect(result.illustration).toBe(false);
      expect(result.lineArtSource).toEqual(result.image);
    });

    it('fails on an HTTP error so the job is retried, then marked failed', async () => {
      fetchMock.mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }));

      await expect(provider.generate(await image(64, 64), style('caricature'))).rejects.toThrow('HTTP 429');
    });

    it('refuses an image flagged as unsafe', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ images: [{ url: 'x' }], has_nsfw_concepts: [true] }));

      await expect(provider.generate(await image(64, 64), style('caricature'))).rejects.toThrow('flagged');
    });
  });

  describe('GeminiAiProvider', () => {
    const provider = new GeminiAiProvider({ apiKey: 'gem-key', model: 'gemini-2.5-flash-image', costUsd: 0.039 });

    it('sends prompt + inline selfie and decodes the inline image of the answer', async () => {
      const generated = (await image(1024, 1024)).toString('base64');
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          responseId: 'resp-1',
          candidates: [{ content: { parts: [{ text: 'Here you go' }, { inlineData: { mimeType: 'image/png', data: generated } }] } }],
        }),
      );

      const result = await provider.generate(await image(64, 64), style('painted'));

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/models/gemini-2.5-flash-image:generateContent');
      expect(init.headers['x-goog-api-key']).toBe('gem-key');
      const body = JSON.parse(init.body);
      expect(body.contents[0].parts[0].text).toContain('Turn this selfie into a caricature.');
      expect(body.contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
      expect(result).toEqual(expect.objectContaining({ providerRequestId: 'resp-1', costUsd: 0.039 }));
    });

    it('reports a blocked prompt', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }));

      await expect(provider.generate(await image(64, 64), style('painted'))).rejects.toThrow('SAFETY');
    });

    it('fails when the answer has no image', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: 'no' }] }, finishReason: 'STOP' }] }));

      await expect(provider.generate(await image(64, 64), style('painted'))).rejects.toThrow('no image');
    });
  });
});
