import { NotFoundException } from '@nestjs/common';
import { AdminKiosksService } from './admin-kiosks.service';
import { PrismaService } from '../prisma/prisma.service';

function kiosk(overrides: Record<string, unknown> = {}) {
  return {
    id: 'kiosk-1',
    eventId: 'event-1',
    name: 'Borne Hall B',
    pairingCode: '123456',
    deviceTokenHash: null,
    lastSeenAt: null,
    status: 'OFFLINE',
    ...overrides,
  };
}

describe('AdminKiosksService', () => {
  let service: AdminKiosksService;
  let prisma: {
    kiosk: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    event: { findUniqueOrThrow: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      kiosk: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      event: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    };
    service = new AdminKiosksService(prisma as unknown as PrismaService);
  });

  it('shows the pairing code only until a tablet is paired, and online only when seen recently', async () => {
    prisma.kiosk.findMany.mockResolvedValue([
      kiosk(),
      kiosk({ id: 'k2', deviceTokenHash: 'hash', lastSeenAt: new Date() }),
      kiosk({ id: 'k3', deviceTokenHash: 'hash', lastSeenAt: new Date(Date.now() - 10 * 60 * 1000) }),
    ]);

    const [waiting, online, offline] = await service.list('event-1');

    expect(waiting).toEqual(expect.objectContaining({ pairingCode: '123456', paired: false, online: false }));
    expect(online).toEqual(expect.objectContaining({ pairingCode: undefined, paired: true, online: true }));
    expect(offline.online).toBe(false);
  });

  it('creates a kiosk with a fresh 6-digit pairing code', async () => {
    prisma.kiosk.create.mockImplementation(async ({ data }) => kiosk(data));

    const created = await service.create('event-1', ' Borne entrée ');

    expect(created.name).toBe('Borne entrée');
    expect(created.pairingCode).toMatch(/^\d{6}$/);
  });

  it('reset revokes the device token and issues a new code', async () => {
    prisma.kiosk.findFirst.mockResolvedValue(kiosk({ deviceTokenHash: 'hash' }));
    prisma.kiosk.update.mockImplementation(async ({ data }) => kiosk(data));

    const reset = await service.reset('event-1', 'kiosk-1');

    expect(prisma.kiosk.update.mock.calls[0][0].data.deviceTokenHash).toBeNull();
    expect(reset.paired).toBe(false);
    expect(reset.pairingCode).toMatch(/^\d{6}$/);
  });

  it('only manages kiosks of the given event', async () => {
    prisma.kiosk.findFirst.mockResolvedValue(null);

    await expect(service.remove('event-2', 'kiosk-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.kiosk.findFirst).toHaveBeenCalledWith({ where: { id: 'kiosk-1', eventId: 'event-2' } });
    expect(prisma.kiosk.delete).not.toHaveBeenCalled();
  });
});
