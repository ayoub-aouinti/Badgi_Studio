import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { PortraitPageData } from './public-page';

const PUBLIC_CODE = /^[0-9A-F]{10}$/;

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
  ) {}

  // Only a ready, not-yet-purged portrait is public; anything else reads as "not found".
  private async findAvailable(code: string) {
    const normalized = code.toUpperCase();
    if (!PUBLIC_CODE.test(normalized)) return null;
    const portrait = await this.prisma.portrait.findUnique({
      where: { publicCode: normalized },
      include: {
        session: {
          include: {
            participant: true,
            kiosk: { include: { event: { include: { studioConfig: true } } } },
          },
        },
      },
    });
    if (!portrait || portrait.status !== 'READY' || portrait.purgedAt || !portrait.framedKey) return null;
    return { ...portrait, framedKey: portrait.framedKey };
  }

  async getPage(code: string): Promise<PortraitPageData | null> {
    const portrait = await this.findAvailable(code);
    if (!portrait) return null;
    const { event } = portrait.session.kiosk;
    return {
      code: portrait.publicCode,
      firstName: portrait.session.participant.firstName,
      eventName: event.name,
      tagline: event.studioConfig?.tagline ?? undefined,
      primaryColor: event.studioConfig?.primaryColor ?? '#0B6E69',
      purgeAt: portrait.purgeAt,
    };
  }

  // Streamed through the API rather than redirected to a storage URL: S3 signed URLs
  // expire after an hour, but this link is sent by email/WhatsApp and kept for weeks.
  async getImage(code: string): Promise<{ image: Buffer; filename: string } | null> {
    const portrait = await this.findAvailable(code);
    if (!portrait) return null;
    return {
      image: await this.storage.get(portrait.framedKey),
      filename: `portrait-${portrait.publicCode}.jpg`,
    };
  }
}
