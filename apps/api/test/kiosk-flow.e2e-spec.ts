import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// End-to-end happy path: pair a kiosk, scan the demo badge, open a session,
// upload a selfie and wait for the real BullMQ worker (mock AI provider) to
// produce a ready portrait. Runs against the dev Postgres/Redis containers
// and the "congres-demo-2026" seed from apps/api/prisma/seed.ts.
describe('Kiosk flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let kioskId: string;
  let sessionId: string | undefined;
  let participantId: string | undefined;
  let portraitId: string | undefined;

  const pairingCode = `9${Date.now().toString().slice(-5)}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const event = await prisma.event.findUniqueOrThrow({ where: { slug: 'congres-demo-2026' } });
    const kiosk = await prisma.kiosk.create({
      data: { eventId: event.id, name: 'E2E test kiosk', pairingCode, status: 'OFFLINE' },
    });
    kioskId = kiosk.id;
  }, 15000);

  afterAll(async () => {
    if (portraitId) await prisma.portrait.delete({ where: { id: portraitId } }).catch(() => undefined);
    if (sessionId) await prisma.captureSession.delete({ where: { id: sessionId } }).catch(() => undefined);
    if (participantId)
      await prisma.studioParticipant.delete({ where: { id: participantId } }).catch(() => undefined);
    await prisma.kiosk.delete({ where: { id: kioskId } }).catch(() => undefined);
    await app.close();
  }, 20000);

  it(
    'pairs, scans the demo badge, opens a session and generates a ready portrait',
    async () => {
      const server = app.getHttpServer();

      const pairRes = await request(server)
        .post('/kiosk/pair')
        .send({ pairingCode })
        .expect(201);
      const deviceToken: string = pairRes.body.deviceToken;
      expect(deviceToken).toMatch(/^[0-9a-f]{64}$/);
      const auth = `Bearer ${deviceToken}`;

      const configRes = await request(server).get('/kiosk/config').set('Authorization', auth).expect(200);
      expect(configRes.body.styles.length).toBeGreaterThanOrEqual(3);
      const styleId: string = configRes.body.styles[0].id;

      const badgeRes = await request(server)
        .post('/kiosk/badge-scan')
        .set('Authorization', auth)
        .send({ token: 'badge-demo-amira' })
        .expect(201);
      expect(badgeRes.body.firstName).toBe('Amira');

      const participantRes = await request(server)
        .post('/kiosk/participants')
        .set('Authorization', auth)
        .send({
          attendeeId: badgeRes.body.attendeeId,
          firstName: badgeRes.body.firstName,
          lastName: badgeRes.body.lastName,
          specialty: badgeRes.body.specialty,
        })
        .expect(201);
      participantId = participantRes.body.participantId;

      const sessionRes = await request(server)
        .post('/kiosk/sessions')
        .set('Authorization', auth)
        .send({
          participantId,
          consents: { aiProcessing: true, wall: true, sponsor: false },
        })
        .expect(201);
      sessionId = sessionRes.body.sessionId;

      const selfie = await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 180, g: 140, b: 120 } },
      })
        .jpeg()
        .toBuffer();

      const portraitRes = await request(server)
        .post(`/kiosk/sessions/${sessionId}/portraits`)
        .set('Authorization', auth)
        .field('styleId', styleId)
        .attach('selfie', selfie, { filename: 'selfie.jpg', contentType: 'image/jpeg' })
        .expect(202);
      portraitId = portraitRes.body.portraitId;
      expect(portraitId).toBeDefined();

      const finalStatus = await waitForPortraitCompletion(prisma, portraitId as string);
      expect(finalStatus.status).toBe('READY');
      expect(finalStatus.resultKey).toBeTruthy();
      expect(finalStatus.framedKey).toBeTruthy();
    },
    30000,
  );
});

async function waitForPortraitCompletion(prisma: PrismaService, portraitId: string) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const portrait = await prisma.portrait.findUniqueOrThrow({ where: { id: portraitId } });
    if (portrait.status === 'READY' || portrait.status === 'FAILED') {
      return portrait;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Timed out waiting for portrait generation');
}
