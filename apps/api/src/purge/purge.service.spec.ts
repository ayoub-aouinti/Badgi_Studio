import { PurgeService } from './purge.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.interface';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const now = new Date('2026-12-02T10:00:00Z');

function duePortrait(overrides: Record<string, unknown> = {}) {
  return {
    id: 'portrait-1',
    selfieKey: 'selfies/s1/a.jpg',
    resultKey: 'portraits/s1/a-result.jpg',
    framedKey: 'portraits/s1/a-framed.jpg',
    sketchKey: 'portraits/s1/a-sketch.svg',
    onWall: true,
    ...overrides,
  };
}

describe('PurgeService', () => {
  let service: PurgeService;
  let prisma: {
    portrait: { findMany: jest.Mock; update: jest.Mock };
    delivery: { updateMany: jest.Mock };
    studioConfig: { findMany: jest.Mock };
    studioParticipant: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let storage: StorageService;
  let realtime: { emitWallRemove: jest.Mock };

  beforeEach(() => {
    prisma = {
      portrait: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      delivery: { updateMany: jest.fn() },
      studioConfig: { findMany: jest.fn().mockResolvedValue([]) },
      studioParticipant: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    storage = { put: jest.fn(), get: jest.fn(), getUrl: jest.fn(), delete: jest.fn().mockResolvedValue(undefined) };
    realtime = { emitWallRemove: jest.fn() };
    service = new PurgeService(
      prisma as unknown as PrismaService,
      storage,
      realtime as unknown as RealtimeGateway,
    );
  });

  it('only selects portraits that are due and not yet purged', async () => {
    await service.purgeDue(now);

    expect(prisma.portrait.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { purgedAt: null, purgeAt: { lte: now } } }),
    );
  });

  it('deletes every file, clears keys and recipients, and removes the portrait from the wall', async () => {
    prisma.portrait.findMany.mockResolvedValueOnce([duePortrait()]);

    const result = await service.purgeDue(now);

    expect(result.portraits).toBe(1);
    expect(storage.delete).toHaveBeenCalledTimes(4);
    expect(storage.delete).toHaveBeenCalledWith('selfies/s1/a.jpg');
    expect(prisma.portrait.update).toHaveBeenCalledWith({
      where: { id: 'portrait-1' },
      data: expect.objectContaining({
        selfieKey: null,
        resultKey: null,
        framedKey: null,
        sketchKey: null,
        onWall: false,
        purgedAt: now,
      }),
    });
    expect(prisma.delivery.updateMany).toHaveBeenCalledWith({
      where: { portraitId: 'portrait-1' },
      data: { recipient: '' },
    });
    expect(realtime.emitWallRemove).toHaveBeenCalledWith({ portraitId: 'portrait-1' });
  });

  it('does not notify the wall for a portrait that was not on it, and skips missing keys', async () => {
    prisma.portrait.findMany.mockResolvedValueOnce([duePortrait({ onWall: false, sketchKey: null, framedKey: null })]);

    await service.purgeDue(now);

    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(realtime.emitWallRemove).not.toHaveBeenCalled();
  });

  it('keeps the portrait due when a file cannot be deleted', async () => {
    prisma.portrait.findMany.mockResolvedValueOnce([duePortrait()]);
    (storage.delete as jest.Mock).mockRejectedValueOnce(new Error('S3 down'));

    await expect(service.purgeDue(now)).rejects.toThrow('S3 down');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('clears participant contacts per event using its retention period', async () => {
    prisma.studioConfig.findMany.mockResolvedValue([{ eventId: 'event-1', retentionDays: 30 }]);
    prisma.studioParticipant.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.purgeDue(now);

    const cutoff = new Date('2026-11-02T10:00:00Z');
    expect(result.participants).toBe(2);
    expect(prisma.studioParticipant.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        eventId: 'event-1',
        createdAt: { lte: cutoff },
        captureSessions: {
          none: { OR: [{ startedAt: { gt: cutoff } }, { portraits: { some: { purgedAt: null } } }] },
        },
      }),
      data: { email: null, whatsappE164: null },
    });
  });
});
