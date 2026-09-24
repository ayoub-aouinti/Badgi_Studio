import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Kiosk } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';

const CONSENT_TEXT_VERSION = '1.0';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(kiosk: Kiosk, dto: CreateSessionDto): Promise<{ sessionId: string }> {
    if (!dto.consents.aiProcessing) {
      throw new BadRequestException('ai_processing consent is mandatory to start a session');
    }

    const participant = await this.prisma.studioParticipant.findUnique({
      where: { id: dto.participantId },
    });
    if (!participant || participant.eventId !== kiosk.eventId) {
      throw new NotFoundException('Participant not found for this event');
    }

    // Consent rows are tied to the participant (docs/SPEC.md), not the session, so a
    // returning participant's consent history is preserved across visits.
    const [session] = await this.prisma.$transaction([
      this.prisma.captureSession.create({
        data: { kioskId: kiosk.id, participantId: participant.id, status: 'IN_PROGRESS' },
      }),
      this.prisma.consent.createMany({
        data: [
          { participantId: participant.id, type: 'AI_PROCESSING', granted: dto.consents.aiProcessing, grantedAt: new Date(), textVersion: CONSENT_TEXT_VERSION },
          { participantId: participant.id, type: 'WALL', granted: dto.consents.wall, grantedAt: new Date(), textVersion: CONSENT_TEXT_VERSION },
          { participantId: participant.id, type: 'SPONSOR', granted: dto.consents.sponsor, grantedAt: new Date(), textVersion: CONSENT_TEXT_VERSION },
        ],
      }),
    ]);

    return { sessionId: session.id };
  }
}
