import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminPortraitDto, PortraitStatus } from '@badgi-studio/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BrandingService } from '../branding/branding.service';

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

export interface UpdatePortraitInput {
  onWall?: boolean;
  pinned?: boolean;
}

// docs/SPEC.md §API: PATCH /portraits/:id — retirer / épingler (approval comes with moderation).
@Injectable()
export class AdminPortraitsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
    private readonly realtime: RealtimeGateway,
    private readonly branding: BrandingService,
  ) {}

  async list(): Promise<AdminPortraitDto[]> {
    const config = await this.branding.getActive();
    const portraits = await this.prisma.portrait.findMany({
      where: { session: { kiosk: { eventId: config.eventId } } },
      orderBy: { createdAt: 'desc' },
      take: LIST_SIZE,
      include: portraitInclude,
    });
    return Promise.all(portraits.map((portrait) => this.toDto(portrait)));
  }

  async update(id: string, input: UpdatePortraitInput): Promise<AdminPortraitDto> {
    const portrait = await this.findInActiveEvent(id);

    if (input.onWall === true && !portrait.onWall) {
      if (portrait.status !== 'READY' || portrait.purgedAt) {
        throw new BadRequestException('Only a ready portrait can be shown on the wall');
      }
      if (!this.hasWallConsent(portrait)) {
        throw new BadRequestException('The participant did not consent to the wall');
      }
    }

    const updated = await this.prisma.portrait.update({
      where: { id },
      data: {
        ...(input.onWall !== undefined && { onWall: input.onWall }),
        ...(input.pinned !== undefined && { pinned: input.pinned }),
      },
      include: portraitInclude,
    });

    if (portrait.onWall && !updated.onWall) {
      this.realtime.emitWallRemove({ portraitId: id });
    } else if (!portrait.onWall && updated.onWall && updated.framedKey) {
      const [framedUrl, resultUrl, sketchUrl] = await Promise.all([
        this.storage.getUrl(updated.framedKey),
        updated.resultKey ? this.storage.getUrl(updated.resultKey) : undefined,
        updated.sketchKey ? this.storage.getUrl(updated.sketchKey) : undefined,
      ]);
      this.realtime.emitWallNew({
        portraitId: id,
        framedUrl,
        resultUrl,
        sketchUrl,
        participantName: updated.session.participant.firstName,
      });
    }

    return this.toDto(updated);
  }

  private async findInActiveEvent(id: string): Promise<PortraitWithRelations> {
    const config = await this.branding.getActive();
    const portrait = await this.prisma.portrait.findFirst({
      where: { id, session: { kiosk: { eventId: config.eventId } } },
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
      createdAt: portrait.createdAt.toISOString(),
      purgeAt: portrait.purgeAt.toISOString(),
      purged: Boolean(portrait.purgedAt),
    };
  }
}
