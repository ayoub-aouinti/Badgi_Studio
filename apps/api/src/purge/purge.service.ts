import { Inject, Injectable, Logger } from '@nestjs/common';
import { Portrait } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const BATCH_SIZE = 100;

export interface PurgeResult {
  portraits: number;
  participants: number;
}

// docs/SPEC.md: automatic purge at J+retentionDays — files deleted, email/phone cleared,
// statistics kept (portrait rows, styles, delivery channels and statuses stay).
@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async purgeDue(now = new Date()): Promise<PurgeResult> {
    let portraits = 0;
    for (;;) {
      const due = await this.prisma.portrait.findMany({
        where: { purgedAt: null, purgeAt: { lte: now } },
        orderBy: { purgeAt: 'asc' },
        take: BATCH_SIZE,
      });
      for (const portrait of due) {
        await this.purgePortrait(portrait, now);
      }
      portraits += due.length;
      if (due.length < BATCH_SIZE) break;
    }

    const participants = await this.clearParticipantContacts(now);
    if (portraits || participants) {
      this.logger.log(`Purged ${portraits} portrait(s), cleared contacts of ${participants} participant(s)`);
    }
    return { portraits, participants };
  }

  private async purgePortrait(portrait: Portrait, now: Date) {
    const keys = [portrait.selfieKey, portrait.resultKey, portrait.framedKey, portrait.sketchKey];
    // Files first: if a delete fails the portrait stays due and the next run retries it.
    for (const key of keys) {
      if (key) await this.storage.delete(key);
    }

    await this.prisma.$transaction([
      this.prisma.portrait.update({
        where: { id: portrait.id },
        data: {
          selfieKey: null,
          resultKey: null,
          framedKey: null,
          sketchKey: null,
          onWall: false,
          pinned: false,
          purgedAt: now,
        },
      }),
      this.prisma.delivery.updateMany({ where: { portraitId: portrait.id }, data: { recipient: '' } }),
    ]);

    if (portrait.onWall) this.realtime.emitWallRemove({ portraitId: portrait.id });
  }

  // A participant's email/WhatsApp is cleared once none of their portraits is still kept
  // and they have not been active within their event's retention period (this also covers
  // participants who never finished a portrait).
  private async clearParticipantContacts(now: Date): Promise<number> {
    const configs = await this.prisma.studioConfig.findMany({ select: { eventId: true, retentionDays: true } });
    let cleared = 0;
    for (const config of configs) {
      const cutoff = new Date(now.getTime() - config.retentionDays * 24 * 60 * 60 * 1000);
      const { count } = await this.prisma.studioParticipant.updateMany({
        where: {
          eventId: config.eventId,
          OR: [{ email: { not: null } }, { whatsappE164: { not: null } }],
          createdAt: { lte: cutoff },
          captureSessions: {
            none: {
              OR: [{ startedAt: { gt: cutoff } }, { portraits: { some: { purgedAt: null } } }],
            },
          },
        },
        data: { email: null, whatsappE164: null },
      });
      cleared += count;
    }
    return cleared;
  }
}
