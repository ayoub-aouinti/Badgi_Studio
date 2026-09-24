import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { KioskService } from './kiosk.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.interface';

describe('KioskService', () => {
  let service: KioskService;
  let prisma: {
    kiosk: { findUnique: jest.Mock; update: jest.Mock };
  };
  let storage: StorageService;

  beforeEach(() => {
    prisma = {
      kiosk: { findUnique: jest.fn(), update: jest.fn() },
    };
    storage = { put: jest.fn(), get: jest.fn(), getUrl: jest.fn() };
    service = new KioskService(prisma as unknown as PrismaService, storage);
  });

  describe('pair', () => {
    it('throws NotFoundException for an unknown pairing code', async () => {
      prisma.kiosk.findUnique.mockResolvedValue(null);

      await expect(service.pair('000000')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when the kiosk is already paired', async () => {
      prisma.kiosk.findUnique.mockResolvedValue({ id: 'k1', deviceTokenHash: 'already-set' });

      await expect(service.pair('123456')).rejects.toBeInstanceOf(ConflictException);
    });

    it('generates a device token and stores only its sha256 hash', async () => {
      prisma.kiosk.findUnique.mockResolvedValue({ id: 'k1', deviceTokenHash: null });
      prisma.kiosk.update.mockResolvedValue({});

      const result = await service.pair('123456');

      expect(result.kioskId).toBe('k1');
      expect(result.deviceToken).toMatch(/^[0-9a-f]{64}$/);

      const expectedHash = createHash('sha256').update(result.deviceToken).digest('hex');
      expect(prisma.kiosk.update).toHaveBeenCalledWith({
        where: { id: 'k1' },
        data: expect.objectContaining({ deviceTokenHash: expectedHash, status: 'ONLINE' }),
      });
    });
  });
});
