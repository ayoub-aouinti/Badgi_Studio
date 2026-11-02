import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminEventsService, slugify } from './admin-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_STYLES } from '../events/default-styles';

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    name: 'Congrès de cardiologie',
    slug: 'congres-de-cardiologie',
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    studioConfig: { id: 'config-1', enabled: true, retentionDays: 30, preModeration: false, wallToken: 'token-1' },
    ...overrides,
  };
}

describe('AdminEventsService', () => {
  let service: AdminEventsService;
  let prisma: {
    event: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    studioConfig: { update: jest.Mock };
    portrait: { count: jest.Mock };
    kiosk: { count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      event: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      studioConfig: { update: jest.fn() },
      portrait: { count: jest.fn().mockResolvedValue(0) },
      kiosk: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new AdminEventsService(
      prisma as unknown as PrismaService,
      new ConfigService({ DEFAULT_RETENTION_DAYS: '15' }),
    );
  });

  it('slugifies French names', () => {
    expect(slugify('Congrès Médical — Sousse 2026')).toBe('congres-medical-sousse-2026');
    expect(slugify('!!!')).toBe('evenement');
  });

  it('creates an event with its studio config, a wall token and the default styles', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    prisma.event.create.mockResolvedValue(event());

    const dto = await service.create({ name: ' Congrès de cardiologie ' });

    const data = prisma.event.create.mock.calls[0][0].data;
    expect(data.name).toBe('Congrès de cardiologie');
    expect(data.slug).toBe('congres-de-cardiologie');
    expect(data.studioConfig.create.retentionDays).toBe(15);
    expect(data.studioConfig.create.wallToken).toEqual(expect.any(String));
    expect(data.studioConfig.create.styles.create).toHaveLength(DEFAULT_STYLES.length);
    expect(dto.wallToken).toBe('token-1');
  });

  it('suffixes the slug when it is already taken', async () => {
    prisma.event.findUnique.mockResolvedValue(event());
    prisma.event.create.mockResolvedValue(event());

    await service.create({ name: 'Congrès de cardiologie' });

    expect(prisma.event.create.mock.calls[0][0].data.slug).toMatch(/^congres-de-cardiologie-[0-9a-f]{6}$/);
  });

  it('updates event and studio settings, clearing a date with null', async () => {
    prisma.event.findUnique.mockResolvedValue(event());

    await service.update('event-1', { name: 'Nouveau nom', endsAt: null, preModeration: true, retentionDays: 7 });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { name: 'Nouveau nom', startsAt: undefined, endsAt: null },
    });
    expect(prisma.studioConfig.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: { enabled: undefined, retentionDays: 7, preModeration: true },
    });
  });

  it('regenerates the wall token', async () => {
    prisma.event.findUnique.mockResolvedValue(event());

    await service.regenerateWallToken('event-1');

    const { data } = prisma.studioConfig.update.mock.calls[0][0];
    expect(data.wallToken).toEqual(expect.any(String));
    expect(data.wallToken).not.toBe('token-1');
  });

  it('404s on an unknown event', async () => {
    prisma.event.findUnique.mockResolvedValue(null);

    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
