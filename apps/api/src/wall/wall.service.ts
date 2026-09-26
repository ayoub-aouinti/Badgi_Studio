import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { WallFeedResponse } from '@badgi-studio/shared';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';

const FEED_SIZE = 11; // 1 featured + up to 10 in the grid (docs/SCREENS.md).

@Injectable()
export class WallService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
  ) {}

  async getFeed(token: string): Promise<WallFeedResponse> {
    const config = await this.prisma.studioConfig.findUnique({ where: { wallToken: token } });
    if (!config) {
      throw new NotFoundException('Wall not found');
    }

    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: config.eventId } });

    const onWallFilter = {
      onWall: true,
      status: 'READY' as const,
      session: { kiosk: { eventId: config.eventId } },
    };

    const [portraitCount, recent] = await Promise.all([
      this.prisma.portrait.count({ where: onWallFilter }),
      this.prisma.portrait.findMany({
        where: onWallFilter,
        orderBy: { createdAt: 'desc' },
        take: FEED_SIZE,
        include: { session: { include: { participant: true } } },
      }),
    ]);

    const portraits = await Promise.all(
      recent.map(async (portrait) => ({
        portraitId: portrait.id,
        framedUrl: await this.storage.getUrl(portrait.framedKey!),
        resultUrl: portrait.resultKey ? await this.storage.getUrl(portrait.resultKey) : undefined,
        sketchUrl: portrait.sketchKey ? await this.storage.getUrl(portrait.sketchKey) : undefined,
        participantName: portrait.session.participant.firstName,
        specialty: portrait.session.participant.specialty ?? undefined,
        createdAt: portrait.createdAt.toISOString(),
      })),
    );

    return {
      eventName: event.name,
      sponsorName: config.sponsorName ?? undefined,
      sponsorLogoUrl: config.sponsorLogoKey ? await this.storage.getUrl(config.sponsorLogoKey) : undefined,
      portraitCount,
      portraits,
    };
  }
}
