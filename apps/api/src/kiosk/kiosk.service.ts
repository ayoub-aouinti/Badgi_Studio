import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Kiosk } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { KioskConfigDto, StylePreset } from '@badgi-studio/shared';
import { BrandingService } from '../branding/branding.service';
import { CreateParticipantDto } from './dto/create-participant.dto';

@Injectable()
export class KioskService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
    private readonly branding: BrandingService,
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
    const config = await this.prisma.studioConfig.findUniqueOrThrow({
      where: { eventId: kiosk.eventId },
      include: { event: true, styles: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
    });

    return {
      branding: await this.branding.toDto(config),
      languages: ['fr', 'en', 'ar'],
      styles: await Promise.all(
        config.styles.map(async (style) => ({
          id: style.id,
          name: style.name,
          previewUrl: style.previewKey ? await this.storage.getUrl(style.previewKey) : undefined,
          preset: style.preset as StylePreset,
          sortOrder: style.sortOrder,
        })),
      ),
    };
  }

  async createParticipant(kiosk: Kiosk, dto: CreateParticipantDto) {
    const participant = await this.prisma.studioParticipant.create({
      data: {
        eventId: kiosk.eventId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        whatsappE164: dto.whatsappE164,
      },
    });

    return { participantId: participant.id };
  }
}
