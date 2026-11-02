import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminPortraitDto, ModerationStatus, PortraitStatus, UpdateAdminPortraitRequest } from '@badgi-studio/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const LIST_SIZE = 60;

const portraitInclude = {
  style: { select: { name: true } },
  session: {
    include: {
      participant: {
        include: { consents: { where: { type: 'WALL' }, orderBy: { grantedAt: 'desc' }, take: 1 } },
      },
    },
  },
} satisfies Prisma.PortraitInclude;

type PortraitWithRelations = Prisma.PortraitGetPayload<{ include: typeof portraitInclude }>;

export interface PortraitListFilter {
  moderation?: ModerationStatus;
}

// docs/SPEC.md §API: PATCH /portraits/:id — retirer / épingler / approuver.
@Injectable()
export class AdminPortraitsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(eventId: string, filter: PortraitListFilter = {}): Promise<AdminPortraitDto[]> {
    const portraits = await this.prisma.portrait.findMany({
      where: {
        session: { kiosk: { eventId } },
        // The moderation queue only lists what can still be shown.
        ...(filter.moderation && { moderation: filter.moderation, purgedAt: null }),
      },
      // Oldest first in the queue (first come, first approved); newest first otherwise.
      orderBy: { createdAt: filter.moderation === 'PENDING' ? 'asc' : 'desc' },
      take: LIST_SIZE,
      include: portraitInclude,
    });
    return Promise.all(portraits.map((portrait) => this.toDto(portrait)));
  }

  async update(eventId: string, id: string, input: UpdateAdminPortraitRequest): Promise<AdminPortraitDto> {
    const portrait = await this.find(eventId, id);
    const showable = portrait.status === 'READY' && !portrait.purgedAt;

    // Approving, or putting back on the wall, is the same organiser decision.
    const approve = input.moderation === 'APPROVED' || (input.onWall === true && !portrait.onWall);
    const reject = input.moderation === 'REJECTED';
    if (approve && !showable) throw new BadRequestException('Only a ready portrait can be approved');
    if (input.onWall === true && !portrait.onWall && !this.hasWallConsent(portrait)) {
      throw new BadRequestException('The participant did not consent to the wall');
    }

    let onWall = input.onWall ?? portrait.onWall;
    if (approve) onWall = this.hasWallConsent(portrait);
    if (reject) onWall = false;

    const updated = await this.prisma.portrait.update({
      where: { id },
      data: {
        onWall,
        ...(input.pinned !== undefined && { pinned: input.pinned }),
        ...((approve || reject) && {
          moderation: approve ? 'APPROVED' : 'REJECTED',
          moderationReason: reject ? 'Rejeté par l’organisateur' : null,
          moderatedAt: new Date(),
        }),
      },
      include: portraitInclude,
    });

    if (portrait.onWall && !updated.onWall) {
      this.realtime.emitWallRemove(eventId, { portraitId: id });
    } else if (!portrait.onWall && updated.onWall && updated.framedKey) {
      const [framedUrl, resultUrl, sketchUrl] = await Promise.all([
        this.storage.getUrl(updated.framedKey),
        updated.resultKey ? this.storage.getUrl(updated.resultKey) : undefined,
        updated.sketchKey ? this.storage.getUrl(updated.sketchKey) : undefined,
      ]);
      this.realtime.emitWallNew(eventId, {
        portraitId: id,
        framedUrl,
        resultUrl,
        sketchUrl,
        participantName: updated.session.participant.firstName,
      });
    }

    return this.toDto(updated);
  }

  private async find(eventId: string, id: string): Promise<PortraitWithRelations> {
    const portrait = await this.prisma.portrait.findFirst({
      where: { id, session: { kiosk: { eventId } } },
      include: portraitInclude,
    });
    if (!portrait) throw new NotFoundException('Portrait not found');
    return portrait;
  }

  private hasWallConsent(portrait: PortraitWithRelations): boolean {
    return portrait.session.participant.consents[0]?.granted ?? false;
  }

  private async toDto(portrait: PortraitWithRelations): Promise<AdminPortraitDto> {
    const { participant } = portrait.session;
    return {
      id: portrait.id,
      publicCode: portrait.publicCode,
      status: portrait.status as PortraitStatus,
      participantName: `${participant.firstName} ${participant.lastName}`,
      styleName: portrait.style.name,
      imageUrl: portrait.framedKey ? await this.storage.getUrl(portrait.framedKey) : undefined,
      onWall: portrait.onWall,
      pinned: portrait.pinned,
      wallConsent: this.hasWallConsent(portrait),
      moderation: portrait.moderation as ModerationStatus,
      moderationReason: portrait.moderationReason ?? undefined,
      createdAt: portrait.createdAt.toISOString(),
      purgeAt: portrait.purgeAt.toISOString(),
      purged: Boolean(portrait.purgedAt),
    };
  }
}
