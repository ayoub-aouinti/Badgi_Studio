import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminPortraitsService } from './admin-portraits.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.interface';
import { RealtimeGateway } from '../realtime/realtime.gateway';

function portrait(overrides: Record<string, unknown> = {}, wallConsent = true) {
  return {
    id: 'portrait-1',
    publicCode: 'ABCDE12345',
    status: 'READY',
    framedKey: 'portraits/s1/framed.jpg',
    resultKey: 'portraits/s1/result.jpg',
    sketchKey: null,
    onWall: true,
    pinned: false,
    moderation: 'NOT_REQUIRED',
    moderationReason: null,
    purgedAt: null,
    createdAt: new Date('2026-11-02T10:00:00Z'),
    purgeAt: new Date('2026-12-02T10:00:00Z'),
    style: { name: 'Caricature' },
    session: {
      participant: { firstName: 'Amira', lastName: 'Ben Ali', consents: [{ granted: wallConsent }] },
    },
    ...overrides,
  };
}

describe('AdminPortraitsService', () => {
  let service: AdminPortraitsService;
  let prisma: { portrait: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock } };
  let realtime: { emitWallRemove: jest.Mock; emitWallNew: jest.Mock };

  beforeEach(() => {
    prisma = { portrait: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() } };
    realtime = { emitWallRemove: jest.fn(), emitWallNew: jest.fn() };
    const storage: StorageService = {
      put: jest.fn(),
      get: jest.fn(),
      getUrl: jest.fn(async (key: string) => `http://files/${key}`),
      delete: jest.fn(),
    };
    service = new AdminPortraitsService(
      prisma as unknown as PrismaService,
      storage,
      realtime as unknown as RealtimeGateway,
    );
  });

  it('removes a portrait from the wall and notifies that event’s wall', async () => {
    prisma.portrait.findFirst.mockResolvedValue(portrait());
    prisma.portrait.update.mockResolvedValue(portrait({ onWall: false }));

    const dto = await service.update('event-1', 'portrait-1', { onWall: false });

    expect(dto.onWall).toBe(false);
    expect(realtime.emitWallRemove).toHaveBeenCalledWith('event-1', { portraitId: 'portrait-1' });
  });

  it('approves a pending portrait: on the wall and announced to the wall screen', async () => {
    prisma.portrait.findFirst.mockResolvedValue(portrait({ onWall: false, moderation: 'PENDING' }));
    prisma.portrait.update.mockResolvedValue(portrait({ onWall: true, moderation: 'APPROVED' }));

    await service.update('event-1', 'portrait-1', { moderation: 'APPROVED' });

    expect(prisma.portrait.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ onWall: true, moderation: 'APPROVED' }) }),
    );
    expect(realtime.emitWallNew).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ portraitId: 'portrait-1', participantName: 'Amira' }),
    );
  });

  it('rejects a portrait: off the wall, reason recorded', async () => {
    prisma.portrait.findFirst.mockResolvedValue(portrait({ onWall: true }));
    prisma.portrait.update.mockResolvedValue(portrait({ onWall: false, moderation: 'REJECTED' }));

    await service.update('event-1', 'portrait-1', { moderation: 'REJECTED' });

    expect(prisma.portrait.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onWall: false, moderation: 'REJECTED', moderationReason: expect.any(String) }),
      }),
    );
    expect(realtime.emitWallRemove).toHaveBeenCalled();
  });

  it('approves without showing a portrait whose participant refused the wall', async () => {
    prisma.portrait.findFirst.mockResolvedValue(portrait({ onWall: false, moderation: 'PENDING' }, false));
    prisma.portrait.update.mockResolvedValue(portrait({ onWall: false, moderation: 'APPROVED' }, false));

    await service.update('event-1', 'portrait-1', { moderation: 'APPROVED' });

    expect(prisma.portrait.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ onWall: false }) }),
    );
    expect(realtime.emitWallNew).not.toHaveBeenCalled();
  });

  it('refuses to put a portrait on the wall without consent', async () => {
    prisma.portrait.findFirst.mockResolvedValue(portrait({ onWall: false }, false));

    await expect(service.update('event-1', 'portrait-1', { onWall: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.portrait.update).not.toHaveBeenCalled();
  });

  it('refuses to approve a purged or automatically refused portrait', async () => {
    prisma.portrait.findFirst.mockResolvedValue(portrait({ onWall: false, status: 'REJECTED', framedKey: null }));

    await expect(service.update('event-1', 'portrait-1', { moderation: 'APPROVED' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('only finds portraits of the given event', async () => {
    prisma.portrait.findFirst.mockResolvedValue(null);

    await expect(service.update('event-1', 'portrait-1', { onWall: false })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.portrait.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'portrait-1', session: { kiosk: { eventId: 'event-1' } } } }),
    );
  });

  it('lists the moderation queue oldest first, without purged portraits', async () => {
    await service.list('event-1', { moderation: 'PENDING' });

    expect(prisma.portrait.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { session: { kiosk: { eventId: 'event-1' } }, moderation: 'PENDING', purgedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });
});
