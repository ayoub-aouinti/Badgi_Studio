import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { DEFAULT_STYLES } from '../src/events/default-styles';

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

  // Matched by sort order so re-seeding renames styles left over from earlier versions.
  for (const style of DEFAULT_STYLES) {
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
