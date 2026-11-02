import { Injectable, NotFoundException } from '@nestjs/common';
import { Kiosk } from '@prisma/client';
import { randomInt } from 'crypto';
import type { AdminKioskDto } from '@badgi-studio/shared';
import { PrismaService } from '../prisma/prisma.service';

// A paired kiosk refreshes its config every minute (apps/kiosk PairingGate), which updates
// lastSeenAt through KioskAuthGuard: silent for longer than this = offline.
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

@Injectable()
export class AdminKiosksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(eventId: string): Promise<AdminKioskDto[]> {
    const kiosks = await this.prisma.kiosk.findMany({ where: { eventId }, orderBy: { name: 'asc' } });
    return kiosks.map((kiosk) => this.toDto(kiosk));
  }

  async create(eventId: string, name: string): Promise<AdminKioskDto> {
    await this.prisma.event.findUniqueOrThrow({ where: { id: eventId } }).catch(() => {
      throw new NotFoundException('Event not found');
    });
    const kiosk = await this.prisma.kiosk.create({
      data: { eventId, name: name.trim(), pairingCode: await this.uniquePairingCode(), status: 'OFFLINE' },
    });
    return this.toDto(kiosk);
  }

  // Unpairs the tablet (its device token stops working) and issues a new pairing code:
  // for a lost tablet, or to move a kiosk to another device.
  async reset(eventId: string, kioskId: string): Promise<AdminKioskDto> {
    await this.find(eventId, kioskId);
    const kiosk = await this.prisma.kiosk.update({
      where: { id: kioskId },
      data: { deviceTokenHash: null, pairingCode: await this.uniquePairingCode(), status: 'OFFLINE', lastSeenAt: null },
    });
    return this.toDto(kiosk);
  }

  async remove(eventId: string, kioskId: string): Promise<void> {
    await this.find(eventId, kioskId);
    await this.prisma.kiosk.delete({ where: { id: kioskId } });
  }

  private async find(eventId: string, kioskId: string): Promise<Kiosk> {
    const kiosk = await this.prisma.kiosk.findFirst({ where: { id: kioskId, eventId } });
    if (!kiosk) throw new NotFoundException('Kiosk not found');
    return kiosk;
  }

  private async uniquePairingCode(): Promise<string> {
    for (;;) {
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      if (!(await this.prisma.kiosk.findUnique({ where: { pairingCode: code } }))) return code;
    }
  }

  private toDto(kiosk: Kiosk): AdminKioskDto {
    const paired = Boolean(kiosk.deviceTokenHash);
    return {
      id: kiosk.id,
      name: kiosk.name,
      pairingCode: paired ? undefined : kiosk.pairingCode,
      paired,
      online: paired && Boolean(kiosk.lastSeenAt && Date.now() - kiosk.lastSeenAt.getTime() < ONLINE_WINDOW_MS),
      lastSeenAt: kiosk.lastSeenAt?.toISOString(),
    };
  }
}
