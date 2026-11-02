import type { StylePreset } from '@badgi-studio/shared';

// Styles every new event starts with (prisma/seed.ts and the admin "Nouvel événement" form).
// `prompt` is what the paid providers (fal/gemini) receive; `preset` drives the local ones.
export const DEFAULT_STYLES: { name: string; preset: StylePreset; prompt: string; model: string; sortOrder: number }[] = [
  {
    name: 'Portrait professionnel',
    preset: 'pro',
    prompt: 'Turn this selfie into a professional studio headshot: soft flattering light, natural skin retouch, sharp focus.',
    model: 'mock',
    sortOrder: 0,
  },
  {
    name: 'Caricature',
    preset: 'caricature',
    prompt:
      'Turn this selfie into a friendly hand-drawn caricature: oversized head on a small body, big expressive eyes, ' +
      'exaggerated smile and most distinctive features, bold ink outlines, warm watercolour colours. Flattering, never mocking.',
    model: 'mock',
    sortOrder: 1,
  },
  {
    name: 'Crayon noir',
    preset: 'pencil',
    prompt: 'Turn this selfie into a black graphite pencil portrait on white paper, fine hatching and soft shading.',
    model: 'mock',
    sortOrder: 2,
  },
  {
    name: 'Portrait peint',
    preset: 'painted',
    prompt: 'Turn this selfie into an oil painting portrait: visible brush strokes, rich warm colours, painterly light.',
    model: 'mock',
    sortOrder: 3,
  },
  {
    name: 'Bande dessinée',
    preset: 'comic',
    prompt: 'Turn this selfie into a franco-belgian comic book character: clean black ink lines, flat bright colours.',
    model: 'mock',
    sortOrder: 4,
  },
];
