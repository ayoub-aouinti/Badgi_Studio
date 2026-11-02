import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const event = await prisma.event.upsert({
    where: { slug: 'congres-demo-2026' },
    update: {},
    create: {
      name: 'Congrès Démo 2026',
      slug: 'congres-demo-2026',
      startsAt: new Date('2026-11-10T08:00:00Z'),
      endsAt: new Date('2026-11-12T18:00:00Z'),
    },
  });

  const studioConfig = await prisma.studioConfig.upsert({
    where: { eventId: event.id },
    update: {},
    create: {
      eventId: event.id,
      enabled: true,
      tagline: 'Votre portrait souvenir',
      retentionDays: 30,
      wallToken: randomUUID(),
    },
  });

  const styles = [
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

  // Matched by sort order so re-seeding renames styles left over from earlier versions.
  for (const style of styles) {
    const existing = await prisma.studioStyle.findFirst({
      where: { configId: studioConfig.id, sortOrder: style.sortOrder },
    });
    if (existing) {
      await prisma.studioStyle.update({ where: { id: existing.id }, data: style });
    } else {
      await prisma.studioStyle.create({ data: { ...style, configId: studioConfig.id, active: true } });
    }
  }

  await prisma.kiosk.upsert({
    where: { pairingCode: '123456' },
    update: {},
    create: {
      eventId: event.id,
      name: 'Borne Hall B',
      pairingCode: '123456',
      status: 'OFFLINE',
    },
  });

  console.log('Seed done:', { event: event.slug, kiosk: '123456' });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
