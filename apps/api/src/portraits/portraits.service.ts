import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Kiosk } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { PORTRAIT_GENERATION_QUEUE } from '../queue/queue.module';
import { CreatePortraitDto } from './dto/create-portrait.dto';

function generatePublicCode(): string {
  return randomBytes(5).toString('hex').toUpperCase();
}

@Injectable()
export class PortraitsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
    @InjectQueue(PORTRAIT_GENERATION_QUEUE) private readonly queue: Queue,
  ) {}

  async createPortrait(
    kiosk: Kiosk,
    sessionId: string,
    dto: CreatePortraitDto,
    file: Express.Multer.File,
  ): Promise<{ portraitId: string }> {
    if (!file) {
      throw new BadRequestException('selfie file is required');
    }

    const session = await this.prisma.captureSession.findUnique({ where: { id: sessionId } });
    if (!session || session.kioskId !== kiosk.id) {
      throw new NotFoundException('Session not found for this kiosk');
    }
    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Session is not in progress');
    }

    const style = await this.prisma.studioStyle.findUnique({
      where: { id: dto.styleId },
      include: { config: true },
    });
    if (!style || !style.active || style.config.eventId !== kiosk.eventId) {
      throw new NotFoundException('Style not available for this event');
    }

    const selfieKey = `selfies/${sessionId}/${randomUUID()}.jpg`;
    await this.storage.put(selfieKey, file.buffer, file.mimetype);

    const purgeAt = new Date();
    purgeAt.setDate(purgeAt.getDate() + style.config.retentionDays);

    const portrait = await this.prisma.portrait.create({
      data: {
        sessionId,
        styleId: style.id,
        selfieKey,
        status: 'QUEUED',
        publicCode: generatePublicCode(),
        purgeAt,
      },
    });

    await this.queue.add('generate', { portraitId: portrait.id });

    return { portraitId: portrait.id };
  }
}
