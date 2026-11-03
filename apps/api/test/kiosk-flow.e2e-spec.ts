import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PurgeService } from '../src/purge/purge.service';
import { CONTENT_MODERATOR, ContentModerator } from '../src/moderation/content-moderator.interface';

// End-to-end flows against the dev Postgres/Redis/Mailpit containers and the real BullMQ
// workers: the organiser creates an event and a kiosk, the tablet pairs, participants take
// portraits. Everything happens in a throwaway event, deleted at the end.
describe('Kiosk flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let adminAuth: string;
  let kioskAuth: string;
  let eventId: string;
  let styleId: string;
  // The automatic moderator is stubbed: the real ONNX model cannot run inside Jest's sandbox.
  let flagNextSelfie = false;
  const moderator: ContentModerator = {
    check: async () => {
      const flagged = flagNextSelfie;
      flagNextSelfie = false;
      return flagged ? { flagged: true, reason: 'test: flagged' } : { flagged: false };
    },
  };

  beforeAll(async () => {
    process.env.QUEUE_PREFIX = 'bull-e2e';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONTENT_MODERATOR)
      .useValue(moderator)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();

    const loginRes = await request(server)
      .post('/admin/login')
      .send({ password: process.env.ADMIN_PASSWORD ?? 'admin' })
      .expect(201);
    adminAuth = `Bearer ${loginRes.body.token}`;

    const eventRes = await request(server)
      .post('/admin/events')
      .set('Authorization', adminAuth)
      .send({ name: `E2E Congrès ${Date.now()}` })
      .expect(201);
    eventId = eventRes.body.id;

    const kioskRes = await request(server)
      .post(`/admin/events/${eventId}/kiosks`)
      .set('Authorization', adminAuth)
      .send({ name: 'E2E kiosk' })
      .expect(201);
    expect(kioskRes.body.pairingCode).toMatch(/^\d{6}$/);

    const pairRes = await request(server).post('/kiosk/pair').send({ pairingCode: kioskRes.body.pairingCode }).expect(201);
    kioskAuth = `Bearer ${pairRes.body.deviceToken}`;

    const configRes = await request(server).get('/kiosk/config').set('Authorization', kioskAuth).expect(200);
    expect(configRes.body.styles).toHaveLength(5);
    styleId = configRes.body.styles[0].id;
  }, 30000);

  afterAll(async () => {
    // Cascades to the config, styles, kiosks, participants, sessions, portraits, deliveries.
    if (eventId) await prisma.event.delete({ where: { id: eventId } }).catch(() => undefined);
    await app.close();
  }, 20000);

  const admin = (path: string) => `/admin/events/${eventId}${path}`;

  async function takePortrait(participant: { firstName: string; lastName: string; email?: string }) {
    const participantRes = await request(server)
      .post('/kiosk/participants')
      .set('Authorization', kioskAuth)
      .send(participant)
      .expect(201);
    const sessionRes = await request(server)
      .post('/kiosk/sessions')
      .set('Authorization', kioskAuth)
      .send({ participantId: participantRes.body.participantId, consents: { aiProcessing: true, wall: true } })
      .expect(201);
    const selfie = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 180, g: 140, b: 120 } },
    })
      .jpeg()
      .toBuffer();
    const portraitRes = await request(server)
      .post(`/kiosk/sessions/${sessionRes.body.sessionId}/portraits`)
      .set('Authorization', kioskAuth)
      .field('styleId', styleId)
      .attach('selfie', selfie, { filename: 'selfie.jpg', contentType: 'image/jpeg' })
      .expect(202);
    const portraitId: string = portraitRes.body.portraitId;
    return waitFor(async () => {
      const portrait = await prisma.portrait.findUniqueOrThrow({ where: { id: portraitId } });
      return ['READY', 'FAILED', 'REJECTED'].includes(portrait.status) ? portrait : null;
    });
  }

  it(
    'generates a portrait, serves its public page, emails it, removes it from the wall, purges it',
    async () => {
      const portrait = await takePortrait({ firstName: 'Amira', lastName: 'Ben Ali', email: 'amira.e2e@example.com' });
      expect(portrait.status).toBe('READY');
      expect(portrait.onWall).toBe(true);
      expect(portrait.moderation).toBe('NOT_REQUIRED');

      // Public download page (docs/SPEC.md: GET /p/:code), linked from the kiosk QR code.
      const pageRes = await request(server).get(`/p/${portrait.publicCode}`).expect(200);
      expect(pageRes.text).toContain('Amira');
      const imageRes = await request(server).get(`/p/${portrait.publicCode}/image?download=1`).expect(200);
      expect(imageRes.headers['content-type']).toContain('image/jpeg');
      expect(imageRes.headers['content-disposition']).toContain('attachment');

      // Email sent through MAIL_DRIVER=smtp (Mailpit in docker-compose).
      const delivery = await waitFor(async () => {
        const found = await prisma.delivery.findFirst({ where: { portraitId: portrait.id } });
        return found && found.status !== 'PENDING' ? found : null;
      });
      expect(delivery).toEqual(
        expect.objectContaining({ channel: 'EMAIL', recipient: 'amira.e2e@example.com', status: 'SENT' }),
      );

      // Organiser removes the portrait from the wall.
      const listRes = await request(server).get(admin('/portraits')).set('Authorization', adminAuth).expect(200);
      expect(listRes.body.map((p: { id: string }) => p.id)).toContain(portrait.id);
      const removeRes = await request(server)
        .patch(admin(`/portraits/${portrait.id}`))
        .set('Authorization', adminAuth)
        .send({ onWall: false })
        .expect(200);
      expect(removeRes.body.onWall).toBe(false);

      // Retention elapsed: the purge deletes the files and the public page disappears.
      await prisma.portrait.update({ where: { id: portrait.id }, data: { purgeAt: new Date(Date.now() - 1000) } });
      await app.get(PurgeService).purgeDue();
      const purged = await prisma.portrait.findUniqueOrThrow({ where: { id: portrait.id } });
      expect(purged.purgedAt).toBeTruthy();
      expect(purged.framedKey).toBeNull();
      await request(server).get(`/p/${portrait.publicCode}`).expect(404);
    },
    60000,
  );

  it(
    'holds portraits for approval when pre-moderation is on',
    async () => {
      await request(server).patch(admin('')).set('Authorization', adminAuth).send({ preModeration: true }).expect(200);

      const portrait = await takePortrait({ firstName: 'Karim', lastName: 'Trabelsi' });
      expect(portrait.status).toBe('READY');
      expect(portrait.onWall).toBe(false);
      expect(portrait.moderation).toBe('PENDING');

      const queueRes = await request(server)
        .get(admin('/portraits?moderation=PENDING'))
        .set('Authorization', adminAuth)
        .expect(200);
      expect(queueRes.body.map((p: { id: string }) => p.id)).toEqual([portrait.id]);

      const approveRes = await request(server)
        .patch(admin(`/portraits/${portrait.id}`))
        .set('Authorization', adminAuth)
        .send({ moderation: 'APPROVED' })
        .expect(200);
      expect(approveRes.body).toEqual(expect.objectContaining({ moderation: 'APPROVED', onWall: true }));

      await request(server).patch(admin('')).set('Authorization', adminAuth).send({ preModeration: false }).expect(200);
    },
    60000,
  );

  it(
    'refuses a flagged selfie without generating anything',
    async () => {
      flagNextSelfie = true;

      const portrait = await takePortrait({ firstName: 'Test', lastName: 'Refus' });

      expect(portrait.status).toBe('REJECTED');
      expect(portrait.moderation).toBe('REJECTED');
      expect(portrait.moderationReason).toBe('test: flagged');
      expect(portrait.resultKey).toBeNull();
      expect(portrait.onWall).toBe(false);
    },
    60000,
  );

  it('reports event statistics, kiosks and participants', async () => {
    const statsRes = await request(server).get(admin('/stats')).set('Authorization', adminAuth).expect(200);
    expect(statsRes.body).toEqual(
      expect.objectContaining({ portraitsReady: 2, autoRejected: 1, participants: 3, emailsSent: 1, kiosksTotal: 1 }),
    );
    expect(statsRes.body.byHour.reduce((sum: number, row: { count: number }) => sum + row.count, 0)).toBe(2);

    const kiosksRes = await request(server).get(admin('/kiosks')).set('Authorization', adminAuth).expect(200);
    expect(kiosksRes.body[0]).toEqual(expect.objectContaining({ paired: true, online: true }));

    const participantsRes = await request(server)
      .get(admin('/participants?q=karim'))
      .set('Authorization', adminAuth)
      .expect(200);
    expect(participantsRes.body).toHaveLength(1);
  });

  it(
    'renders the drawing video and the poster, publishes the gallery, exports the ZIP, records prints',
    async () => {
      const approved = await prisma.portrait.findFirstOrThrow({
        where: { session: { kiosk: { eventId } }, moderation: 'APPROVED' },
      });

      // Drawing video: rendered in the background, streamed with byte ranges (iOS Safari).
      await waitFor(async () => {
        const portrait = await prisma.portrait.findUniqueOrThrow({ where: { id: approved.id } });
        return portrait.videoKey ? portrait : null;
      }, 60000);
      const videoRes = await request(server).get(`/p/${approved.publicCode}/video`).set('Range', 'bytes=0-99').expect(206);
      expect(videoRes.headers['content-type']).toContain('video/mp4');
      expect(videoRes.headers['content-range']).toMatch(/^bytes 0-99\/\d+$/);

      // Online gallery: off by default, then lists the wall portraits.
      const eventRes = await request(server).get(admin('')).set('Authorization', adminAuth).expect(200);
      await request(server).get(`/g/${eventRes.body.galleryToken}`).expect(404);
      await request(server).patch(admin('')).set('Authorization', adminAuth).send({ galleryEnabled: true }).expect(200);
      const galleryRes = await request(server).get(`/g/${eventRes.body.galleryToken}`).expect(200);
      expect(galleryRes.text).toContain(approved.publicCode);

      // Kiosk printing: refused until the organiser enables it, then counted.
      await request(server).post(`/kiosk/portraits/${approved.id}/print`).set('Authorization', kioskAuth).expect(403);
      await request(server).patch(admin('')).set('Authorization', adminAuth).send({ printEnabled: true }).expect(200);
      const configRes = await request(server).get('/kiosk/config').set('Authorization', kioskAuth).expect(200);
      expect(configRes.body.printEnabled).toBe(true);
      await request(server).post(`/kiosk/portraits/${approved.id}/print`).set('Authorization', kioskAuth).expect(201);
      const statsRes = await request(server).get(admin('/stats')).set('Authorization', adminAuth).expect(200);
      expect(statsRes.body).toEqual(expect.objectContaining({ prints: 1, videos: 1 }));

      // Organiser archive.
      const zipRes = await request(server)
        .get(admin('/portraits.zip'))
        .set('Authorization', adminAuth)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect((zipRes.body as Buffer).subarray(0, 2).toString()).toBe('PK');

      // Printable poster, rendered by a background job and polled.
      const jobRes = await request(server).post(admin('/poster')).set('Authorization', adminAuth).send({ format: 'A3' }).expect(201);
      const poster = await waitFor(async () => {
        const res = await request(server).get(admin(`/poster/${jobRes.body.jobId}`)).set('Authorization', adminAuth).expect(200);
        return ['completed', 'failed'].includes(res.body.status) ? res.body : null;
      }, 60000);
      expect(poster).toEqual(expect.objectContaining({ status: 'completed', count: 1 }));
      expect(poster.pdfUrl).toMatch(/\.pdf$/);
    },
    150000,
  );
});

async function waitFor<T>(probe: () => Promise<T | null>, timeoutMs = 20000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Timed out waiting for condition');
}
