import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Kiosk } from '@prisma/client';
import { PortraitsService } from './portraits.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.interface';

const kiosk = { id: 'kiosk-1', eventId: 'event-1' } as Kiosk;
const file = { buffer: Buffer.from('fake-image'), mimetype: 'image/jpeg' } as Express.Multer.File;

describe('PortraitsService', () => {
  let service: PortraitsService;
  let prisma: {
    captureSession: { findUnique: jest.Mock };
    studioStyle: { findUnique: jest.Mock };
    portrait: { create: jest.Mock };
  };
  let storage: StorageService;
  let queue: { add: jest.Mock };

  beforeEach(() => {
    prisma = {
      captureSession: { findUnique: jest.fn() },
      studioStyle: { findUnique: jest.fn() },
      portrait: { create: jest.fn() },
    };
    storage = { put: jest.fn().mockResolvedValue('key'), get: jest.fn(), getUrl: jest.fn() };
    queue = { add: jest.fn() };
    service = new PortraitsService(
      prisma as unknown as PrismaService,
      storage,
      queue as any,
    );
  });

  it('rejects when no selfie file is provided', async () => {
    await expect(
      service.createPortrait(kiosk, 'session-1', { styleId: 'style-1' }, undefined as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the session does not belong to this kiosk', async () => {
    prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', kioskId: 'other-kiosk', status: 'IN_PROGRESS' });

    await expect(
      service.createPortrait(kiosk, 'session-1', { styleId: 'style-1' }, file),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when the session is no longer in progress', async () => {
    prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', kioskId: kiosk.id, status: 'COMPLETED' });

    await expect(
      service.createPortrait(kiosk, 'session-1', { styleId: 'style-1' }, file),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive or foreign style', async () => {
    prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', kioskId: kiosk.id, status: 'IN_PROGRESS' });
    prisma.studioStyle.findUnique.mockResolvedValue({
      id: 'style-1',
      active: false,
      config: { eventId: kiosk.eventId, retentionDays: 30 },
    });

    await expect(
      service.createPortrait(kiosk, 'session-1', { styleId: 'style-1' }, file),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uploads the selfie, creates a QUEUED portrait and enqueues a generation job', async () => {
    prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', kioskId: kiosk.id, status: 'IN_PROGRESS' });
    prisma.studioStyle.findUnique.mockResolvedValue({
      id: 'style-1',
      active: true,
      config: { eventId: kiosk.eventId, retentionDays: 30 },
    });
    prisma.portrait.create.mockResolvedValue({ id: 'portrait-1' });

    const result = await service.createPortrait(kiosk, 'session-1', { styleId: 'style-1' }, file);

    expect(result).toEqual({ portraitId: 'portrait-1' });
    expect(storage.put).toHaveBeenCalledWith(expect.stringContaining('selfies/session-1/'), file.buffer, file.mimetype);
    expect(prisma.portrait.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: 'session-1', styleId: 'style-1', status: 'QUEUED' }),
      }),
    );
    expect(queue.add).toHaveBeenCalledWith('generate', { portraitId: 'portrait-1' });
  });
});
