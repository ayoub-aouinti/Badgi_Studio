import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminParticipantDto } from '@badgi-studio/shared';
import { PrismaService } from '../prisma/prisma.service';

const LIST_SIZE = 200;

@Injectable()
export class AdminParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(eventId: string, query?: string): Promise<AdminParticipantDto[]> {
    const q = query?.trim();
    const where: Prisma.StudioParticipantWhereInput = {
      eventId,
      ...(q && {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };
    const participants = await this.prisma.studioParticipant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: LIST_SIZE,
      include: {
        consents: { where: { type: 'WALL' }, orderBy: { grantedAt: 'desc' }, take: 1 },
        captureSessions: { select: { _count: { select: { portraits: { where: { status: 'READY' } } } } } },
      },
    });
    return participants.map((participant) => ({
      id: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
      email: participant.email ?? undefined,
      whatsappE164: participant.whatsappE164 ?? undefined,
      createdAt: participant.createdAt.toISOString(),
      portraitCount: participant.captureSessions.reduce((sum, session) => sum + session._count.portraits, 0),
      wallConsent: participant.consents[0]?.granted ?? false,
    }));
  }
}
