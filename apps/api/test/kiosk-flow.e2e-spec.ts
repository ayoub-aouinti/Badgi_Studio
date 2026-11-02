import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PurgeService } from '../src/purge/purge.service';

// End-to-end happy path: pair a kiosk, enter a name, open a session,
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
    'pairs, enters a name, opens a session and generates a ready portrait',
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

      const participantRes = await request(server)
        .post('/kiosk/participants')
        .set('Authorization', auth)
        .send({ firstName: 'Amira', lastName: 'Ben Ali', email: 'amira.e2e@example.com' })
        .expect(201);
      participantId = participantRes.body.participantId;

      const sessionRes = await request(server)
        .post('/kiosk/sessions')
        .set('Authorization', auth)
        .send({
          participantId,
          consents: { aiProcessing: true, wall: true },
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
      expect(finalStatus.onWall).toBe(true);

      // Public download page (docs/SPEC.md: GET /p/:code), linked from the kiosk QR code.
      const pageRes = await request(server).get(`/p/${finalStatus.publicCode}`).expect(200);
      expect(pageRes.text).toContain('Amira');
      const imageRes = await request(server).get(`/p/${finalStatus.publicCode}/image?download=1`).expect(200);
      expect(imageRes.headers['content-type']).toContain('image/jpeg');
      expect(imageRes.headers['content-disposition']).toContain('attachment');

      // Email sent through MAIL_DRIVER=smtp (Mailpit in docker-compose).
      const delivery = await waitFor(async () => {
        const found = await prisma.delivery.findFirst({ where: { portraitId: portraitId as string } });
        return found && found.status !== 'PENDING' ? found : null;
      });
      expect(delivery).toEqual(
        expect.objectContaining({ channel: 'EMAIL', recipient: 'amira.e2e@example.com', status: 'SENT' }),
      );

      // Organiser removes the portrait from the wall.
      const loginRes = await request(server)
        .post('/admin/login')
        .send({ password: process.env.ADMIN_PASSWORD ?? 'admin' })
        .expect(201);
      const adminAuth = `Bearer ${loginRes.body.token}`;
      const listRes = await request(server).get('/admin/portraits').set('Authorization', adminAuth).expect(200);
      expect(listRes.body.map((p: { id: string }) => p.id)).toContain(portraitId);
      const removeRes = await request(server)
        .patch(`/admin/portraits/${portraitId}`)
        .set('Authorization', adminAuth)
        .send({ onWall: false })
        .expect(200);
      expect(removeRes.body.onWall).toBe(false);

      // Retention elapsed: the purge deletes the files and the public page disappears.
      await prisma.portrait.update({ where: { id: portraitId }, data: { purgeAt: new Date(Date.now() - 1000) } });
      await app.get(PurgeService).purgeDue();
      const purged = await prisma.portrait.findUniqueOrThrow({ where: { id: portraitId } });
      expect(purged.purgedAt).toBeTruthy();
      expect(purged.framedKey).toBeNull();
      await request(server).get(`/p/${finalStatus.publicCode}`).expect(404);
    },
    60000,
  );
});

async function waitFor<T>(probe: () => Promise<T | null>, timeoutMs = 15000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Timed out waiting for condition');
}

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
