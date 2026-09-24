import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Kiosk, ParticipantSource } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { KioskConfigDto } from '@badgi-studio/shared';
import { BadgeScanDto } from './dto/badge-scan.dto';
import { CreateParticipantDto } from './dto/create-participant.dto';

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return `${user[0] ?? ''}***@${domain}`;
}

@Injectable()
export class KioskService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
  ) {}

  async pair(pairingCode: string): Promise<{ kioskId: string; deviceToken: string }> {
    const kiosk = await this.prisma.kiosk.findUnique({ where: { pairingCode } });
    if (!kiosk) {
      throw new NotFoundException('Unknown pairing code');
    }
    if (kiosk.deviceTokenHash) {
      throw new ConflictException('Kiosk is already paired');
    }

    const deviceToken = randomBytes(32).toString('hex');
    const deviceTokenHash = createHash('sha256').update(deviceToken).digest('hex');

    await this.prisma.kiosk.update({
      where: { id: kiosk.id },
      data: { deviceTokenHash, status: 'ONLINE', lastSeenAt: new Date() },
    });

    return { kioskId: kiosk.id, deviceToken };
  }

  async getConfig(kiosk: Kiosk): Promise<KioskConfigDto> {
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: kiosk.eventId },
      include: { studioConfig: { include: { styles: { where: { active: true } } } } },
    });

    const styles = event.studioConfig?.styles.sort((a, b) => a.sortOrder - b.sortOrder) ?? [];

    return {
      eventName: event.name,
      sponsorName: event.studioConfig?.sponsorName ?? undefined,
      sponsorLogoUrl: event.studioConfig?.sponsorLogoKey
        ? await this.storage.getUrl(event.studioConfig.sponsorLogoKey)
        : undefined,
      languages: ['fr', 'en', 'ar'],
      styles: await Promise.all(
        styles.map(async (style) => ({
          id: style.id,
          name: style.name,
          previewUrl: style.previewKey ? await this.storage.getUrl(style.previewKey) : undefined,
          sortOrder: style.sortOrder,
        })),
      ),
    };
  }

  async badgeScan(dto: BadgeScanDto, eventId: string) {
    const attendee = await this.prisma.attendee.findUnique({ where: { badgeToken: dto.token } });
    if (!attendee || attendee.eventId !== eventId) {
      throw new NotFoundException('Badge not recognized');
    }

    return {
      attendeeId: attendee.id,
      firstName: attendee.firstName,
      lastName: attendee.lastName,
      specialty: attendee.specialty ?? undefined,
      emailMasked: attendee.email ? maskEmail(attendee.email) : undefined,
      whatsappE164: attendee.whatsappE164 ?? undefined,
    };
  }

  async createParticipant(kiosk: Kiosk, dto: CreateParticipantDto) {
    if (dto.attendeeId) {
      const attendee = await this.prisma.attendee.findUnique({ where: { id: dto.attendeeId } });
      if (!attendee || attendee.eventId !== kiosk.eventId) {
        throw new NotFoundException('Attendee not found for this event');
      }
    }

    const source: ParticipantSource = dto.attendeeId ? 'BADGE' : 'MANUAL';

    const participant = await this.prisma.studioParticipant.create({
      data: {
        eventId: kiosk.eventId,
        attendeeId: dto.attendeeId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        whatsappE164: dto.whatsappE164,
        specialty: dto.specialty,
        source,
      },
    });

    return { participantId: participant.id };
  }
}
