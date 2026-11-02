import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DELIVERY_QUEUE } from '../queue/queue.module';

export const SEND_EMAIL_JOB = 'send-email';

export interface SendEmailJobData {
  deliveryId: string;
}

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DELIVERY_QUEUE) private readonly queue: Queue,
  ) {}

  // Called once a portrait is READY (docs/SPEC.md §Génération, step 3). WhatsApp in
  // WHATSAPP_MODE=link is a QR on the kiosk Result screen, so nothing is sent from here.
  async enqueueForPortrait(portraitId: string): Promise<void> {
    const portrait = await this.prisma.portrait.findUniqueOrThrow({
      where: { id: portraitId },
      include: { session: { include: { participant: true } } },
    });
    const email = portrait.session.participant.email;
    if (!email) return;

    const delivery = await this.prisma.delivery.create({
      data: { portraitId, channel: 'EMAIL', recipient: email, status: 'PENDING' },
    });
    await this.queue.add(SEND_EMAIL_JOB, { deliveryId: delivery.id } satisfies SendEmailJobData);
  }
}
