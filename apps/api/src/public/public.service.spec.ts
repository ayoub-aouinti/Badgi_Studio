import { PublicService } from './public.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.interface';
import { renderPortraitPage } from './public-page';

function portrait(overrides: Record<string, unknown> = {}) {
  return {
    publicCode: 'ABCDE12345',
    status: 'READY',
    purgedAt: null,
    framedKey: 'portraits/s1/framed.jpg',
    purgeAt: new Date('2026-12-02T10:00:00Z'),
    session: {
      participant: { firstName: 'Amira' },
      kiosk: { event: { name: 'Congrès démo', studioConfig: { tagline: null, primaryColor: '#123456' } } },
    },
    ...overrides,
  };
}

describe('PublicService', () => {
  let service: PublicService;
  let prisma: { portrait: { findUnique: jest.Mock } };
  let storage: StorageService;

  beforeEach(() => {
    prisma = { portrait: { findUnique: jest.fn() } };
    storage = {
      put: jest.fn(),
      get: jest.fn().mockResolvedValue(Buffer.from('jpeg')),
      getUrl: jest.fn(),
      delete: jest.fn(),
    };
    service = new PublicService(prisma as unknown as PrismaService, storage);
  });

  it('rejects malformed codes without querying the database', async () => {
    expect(await service.getPage('../etc')).toBeNull();
    expect(prisma.portrait.findUnique).not.toHaveBeenCalled();
  });

  it('accepts a lower-case code', async () => {
    prisma.portrait.findUnique.mockResolvedValue(portrait());

    const page = await service.getPage('abcde12345');

    expect(prisma.portrait.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicCode: 'ABCDE12345' } }),
    );
    expect(page).toEqual(expect.objectContaining({ firstName: 'Amira', eventName: 'Congrès démo' }));
  });

  it.each([
    ['not ready', { status: 'GENERATING', framedKey: null }],
    ['purged', { purgedAt: new Date(), framedKey: null }],
  ])('hides a %s portrait', async (_label, overrides) => {
    prisma.portrait.findUnique.mockResolvedValue(portrait(overrides));

    expect(await service.getPage('ABCDE12345')).toBeNull();
    expect(await service.getImage('ABCDE12345')).toBeNull();
  });

  it('serves the framed image from storage', async () => {
    prisma.portrait.findUnique.mockResolvedValue(portrait());

    const file = await service.getImage('ABCDE12345');

    expect(storage.get).toHaveBeenCalledWith('portraits/s1/framed.jpg');
    expect(file).toEqual({ image: Buffer.from('jpeg'), filename: 'portrait-ABCDE12345.jpg' });
  });

  it('escapes participant and event names in the page', () => {
    const html = renderPortraitPage({
      code: 'ABCDE12345',
      firstName: '<img src=x onerror=alert(1)>',
      eventName: 'A & B',
      primaryColor: 'red;}</style><script>',
      purgeAt: new Date('2026-12-02T10:00:00Z'),
    });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('A &amp; B');
    expect(html).not.toContain('</style><script>');
  });
});
