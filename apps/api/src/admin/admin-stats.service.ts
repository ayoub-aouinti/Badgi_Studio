import { Injectable } from '@nestjs/common';
import type { EventStatsDto, StylePreset } from '@badgi-studio/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AdminKiosksService } from './admin-kiosks.service';

// docs/SCREENS.md §Tableau de bord: generated portraits, deliveries, AI cost, kiosks, styles.
// Counts survive the purge (portrait rows and delivery statuses are kept).
@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kiosks: AdminKiosksService,
  ) {}

  async get(eventId: string): Promise<EventStatsDto> {
    const inEvent = { session: { kiosk: { eventId } } };
    const [
      participants,
      portraitsReady,
      portraitsFailed,
      autoRejected,
      pendingModeration,
      onWall,
      emailsSent,
      emailsFailed,
      cost,
      styleCounts,
      styles,
      byHour,
      kiosks,
    ] = await Promise.all([
      this.prisma.studioParticipant.count({ where: { eventId } }),
      this.prisma.portrait.count({ where: { ...inEvent, status: 'READY' } }),
      this.prisma.portrait.count({ where: { ...inEvent, status: 'FAILED' } }),
      this.prisma.portrait.count({ where: { ...inEvent, status: 'REJECTED' } }),
      this.prisma.portrait.count({ where: { ...inEvent, moderation: 'PENDING', purgedAt: null } }),
      this.prisma.portrait.count({ where: { ...inEvent, onWall: true } }),
      this.prisma.delivery.count({ where: { channel: 'EMAIL', status: 'SENT', portrait: inEvent } }),
      this.prisma.delivery.count({ where: { channel: 'EMAIL', status: 'FAILED', portrait: inEvent } }),
      this.prisma.portrait.aggregate({ where: inEvent, _sum: { costUsd: true } }),
      this.prisma.portrait.groupBy({ by: ['styleId'], where: { ...inEvent, status: 'READY' }, _count: { _all: true } }),
      this.prisma.studioStyle.findMany({ where: { config: { eventId } }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.$queryRaw<{ hour: Date; count: bigint }[]>`
        SELECT date_trunc('hour', p.created_at) AS hour, COUNT(*) AS count
        FROM portraits p
        JOIN capture_sessions s ON s.id = p.session_id
        JOIN kiosks k ON k.id = s.kiosk_id
        WHERE k.event_id = ${eventId} AND p.status = 'READY'
        GROUP BY 1
        ORDER BY 1`,
      this.kiosks.list(eventId),
    ]);

    const countByStyle = new Map(styleCounts.map((row) => [row.styleId, row._count._all]));
    return {
      participants,
      portraitsReady,
      portraitsFailed,
      autoRejected,
      pendingModeration,
      onWall,
      emailsSent,
      emailsFailed,
      aiCostUsd: Number(cost._sum.costUsd ?? 0),
      kiosksOnline: kiosks.filter((kiosk) => kiosk.online).length,
      kiosksTotal: kiosks.length,
      byStyle: styles.map((style) => ({
        styleId: style.id,
        name: style.name,
        preset: style.preset as StylePreset,
        count: countByStyle.get(style.id) ?? 0,
      })),
      byHour: byHour.map((row) => ({ hour: row.hour.toISOString(), count: Number(row.count) })),
    };
  }
}
