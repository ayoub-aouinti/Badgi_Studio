import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminPortraitsService } from './admin-portraits.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.interface';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BrandingService } from '../branding/branding.service';

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
    prisma = { portrait: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() } };
    realtime = { emitWallRemove: jest.fn(), emitWallNew: jest.fn() };
    const storage: StorageService = {
      put: jest.fn(),
      get: jest.fn(),
      getUrl: jest.fn(async (key: string) => `http://files/${key}`),
      delete: jest.fn(),
    };
    const branding = { getActive: jest.fn().mockResolvedValue({ eventId: 'event-1' }) };
    service = new AdminPortraitsService(
      prisma as unknown as PrismaService,
      storage,
      realtime as unknown as RealtimeGateway,
      branding as unknown as BrandingService,
    );
  });

  it('removes a portrait from the wall and notifies the wall screen', async () => {
    prisma.portrait.findFirst.mockResolvedValue(portrait());
    prisma.portrait.update.mockResolvedValue(portrait({ onWall: false }));

    const dto = await service.update('portrait-1', { onWall: false });

    expect(dto.onWall).toBe(false);
    expect(realtime.emitWallRemove).toHaveBeenCalledWith({ portraitId: 'portrait-1' });
  });

  it('puts a consenting portrait back on the wall', async () => {
    prisma.portrait.findFirst.mockResolvedValue(portrait({ onWall: false }));
    prisma.portrait.update.mockResolvedValue(portrait({ onWall: true }));

    await service.update('portrait-1', { onWall: true });

    expect(realtime.emitWallNew).toHaveBeenCalledWith(
      expect.objectContaining({ portraitId: 'portrait-1', participantName: 'Amira', framedUrl: 'http://files/portraits/s1/framed.jpg' }),
    );
  });

  it('refuses to show a portrait whose participant did not consent to the wall', async () => {
    prisma.portrait.findFirst.mockResolvedValue(portrait({ onWall: false }, false));

    await expect(service.update('portrait-1', { onWall: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.portrait.update).not.toHaveBeenCalled();
  });

  it('refuses to show a purged portrait', async () => {
    prisma.portrait.findFirst.mockResolvedValue(portrait({ onWall: false, purgedAt: new Date(), framedKey: null }));

    await expect(service.update('portrait-1', { onWall: true })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only finds portraits of the active event', async () => {
    prisma.portrait.findFirst.mockResolvedValue(null);

    await expect(service.update('portrait-1', { onWall: false })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.portrait.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'portrait-1', session: { kiosk: { eventId: 'event-1' } } } }),
    );
  });
});
