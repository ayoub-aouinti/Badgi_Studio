import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const event = await prisma.event.upsert({
    where: { slug: 'congres-demo-2026' },
    update: {},
    create: {
      name: 'Congrès Démo Badgi 2026',
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
      frameTemplate: 'default',
      sponsorName: 'Sponsor Démo',
      retentionDays: 30,
      wallToken: randomUUID(),
    },
  });

  const styles = [
    {
      name: 'Portrait professionnel',
      prompt:
        'Professional studio portrait, neutral background, soft lighting, business attire, high detail.',
      model: 'mock',
      sortOrder: 0,
    },
    {
      name: 'Caricature spécialité',
      prompt:
        'Playful caricature portrait referencing the attendee medical specialty, warm colors, exaggerated friendly features.',
      model: 'mock',
      sortOrder: 1,
    },
    {
      name: 'Portrait peint',
      prompt:
        'Painted portrait, oil painting texture, warm palette, congress-themed background.',
      model: 'mock',
      sortOrder: 2,
    },
  ];

  for (const style of styles) {
    const existing = await prisma.studioStyle.findFirst({
      where: { configId: studioConfig.id, name: style.name },
    });
    if (!existing) {
      await prisma.studioStyle.create({
        data: { ...style, configId: studioConfig.id, active: true },
      });
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

  const attendees = [
    {
      firstName: 'Amira',
      lastName: 'Ben Ali',
      email: 'amira.benali@example.com',
      whatsappE164: '+21620000001',
      specialty: 'Cardiologie',
      badgeToken: 'badge-demo-amira',
    },
    {
      firstName: 'Karim',
      lastName: 'Trabelsi',
      email: 'karim.trabelsi@example.com',
      whatsappE164: '+21620000002',
      specialty: 'Pédiatrie',
      badgeToken: 'badge-demo-karim',
    },
    {
      firstName: 'Sana',
      lastName: 'Gharbi',
      email: 'sana.gharbi@example.com',
      whatsappE164: '+21620000003',
      specialty: 'Dermatologie',
      badgeToken: 'badge-demo-sana',
    },
  ];

  for (const attendee of attendees) {
    await prisma.attendee.upsert({
      where: { badgeToken: attendee.badgeToken },
      update: {},
      create: { ...attendee, eventId: event.id },
    });
  }

  console.log('Seed done:', { event: event.slug, kiosk: '123456', attendees: attendees.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
