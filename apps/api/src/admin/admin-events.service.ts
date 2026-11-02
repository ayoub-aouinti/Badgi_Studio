import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Event, StudioConfig } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import type { AdminEventDto, CreateEventRequest, UpdateEventRequest } from '@badgi-studio/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_STYLES } from '../events/default-styles';

type EventWithConfig = Event & { studioConfig: StudioConfig | null };

export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'evenement';
}

@Injectable()
export class AdminEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(): Promise<AdminEventDto[]> {
    const events = await this.prisma.event.findMany({
      include: { studioConfig: true },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(events.filter((e) => e.studioConfig).map((event) => this.toDto(event)));
  }

  async get(eventId: string): Promise<AdminEventDto> {
    return this.toDto(await this.find(eventId));
  }

  // A new event comes with its studio config (branding defaults, own wall token) and the
  // default styles, so a kiosk paired to it works straight away.
  async create(dto: CreateEventRequest): Promise<AdminEventDto> {
    const retentionDays = parseInt(this.config.get<string>('DEFAULT_RETENTION_DAYS') ?? '30', 10) || 30;
    const event = await this.prisma.event.create({
      data: {
        name: dto.name.trim(),
        slug: await this.uniqueSlug(slugify(dto.name)),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        studioConfig: {
          create: {
            enabled: true,
            retentionDays,
            wallToken: randomUUID(),
            styles: { create: DEFAULT_STYLES.map((style) => ({ ...style, active: true })) },
          },
        },
      },
      include: { studioConfig: true },
    });
    return this.toDto(event);
  }

  async update(eventId: string, dto: UpdateEventRequest): Promise<AdminEventDto> {
    const event = await this.find(eventId);
    const date = (value: string | null | undefined) => (value === undefined ? undefined : value ? new Date(value) : null);
    await this.prisma.event.update({
      where: { id: eventId },
      data: { name: dto.name?.trim(), startsAt: date(dto.startsAt), endsAt: date(dto.endsAt) },
    });
    await this.prisma.studioConfig.update({
      where: { id: event.studioConfig!.id },
      data: { enabled: dto.enabled, retentionDays: dto.retentionDays, preModeration: dto.preModeration },
    });
    return this.get(eventId);
  }

  // The old wall URL stops working (e.g. it leaked); the wall screen needs the new link.
  async regenerateWallToken(eventId: string): Promise<AdminEventDto> {
    const event = await this.find(eventId);
    await this.prisma.studioConfig.update({ where: { id: event.studioConfig!.id }, data: { wallToken: randomUUID() } });
    return this.get(eventId);
  }

  private async find(eventId: string): Promise<EventWithConfig> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { studioConfig: true } });
    if (!event?.studioConfig) throw new NotFoundException('Event not found');
    return event;
  }

  private async uniqueSlug(base: string): Promise<string> {
    if (!(await this.prisma.event.findUnique({ where: { slug: base } }))) return base;
    return `${base}-${randomBytes(3).toString('hex')}`;
  }

  private async toDto(event: EventWithConfig): Promise<AdminEventDto> {
    const config = event.studioConfig!;
    const inEvent = { session: { kiosk: { eventId: event.id } } };
    const [portraitCount, pendingCount, kioskCount] = await Promise.all([
      this.prisma.portrait.count({ where: { ...inEvent, status: 'READY' } }),
      this.prisma.portrait.count({ where: { ...inEvent, moderation: 'PENDING', purgedAt: null } }),
      this.prisma.kiosk.count({ where: { eventId: event.id } }),
    ]);
    return {
      id: event.id,
      name: event.name,
      slug: event.slug,
      startsAt: event.startsAt?.toISOString(),
      endsAt: event.endsAt?.toISOString(),
      enabled: config.enabled,
      retentionDays: config.retentionDays,
      preModeration: config.preModeration,
      wallToken: config.wallToken,
      portraitCount,
      pendingCount,
      kioskCount,
    };
  }
}
