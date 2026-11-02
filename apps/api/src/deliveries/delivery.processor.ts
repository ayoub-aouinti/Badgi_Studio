import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { MAIL_SENDER, MailSender } from '../mail/mail.interface';
import { DELIVERY_QUEUE } from '../queue/queue.module';
import { publicPortraitUrl } from '../public/public-url';
import { SendEmailJobData } from './deliveries.service';
import { buildPortraitEmail } from './portrait-email';

@Processor(DELIVERY_QUEUE)
export class DeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(DeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {
    super();
  }

  async process(job: Job<SendEmailJobData>): Promise<void> {
    const delivery = await this.prisma.delivery.findUniqueOrThrow({
      where: { id: job.data.deliveryId },
      include: {
        portrait: { include: { session: { include: { participant: true, kiosk: { include: { event: { include: { studioConfig: true } } } } } } } },
      },
    });
    // A retry after a send whose status update failed must not email the guest twice.
    if (delivery.status === 'SENT') return;

    const { portrait } = delivery;
    if (portrait.purgedAt || !portrait.framedKey) {
      await this.markFailed(delivery.id, 'Portrait no longer available');
      return;
    }

    const { event } = portrait.session.kiosk;
    const message = buildPortraitEmail({
      to: delivery.recipient,
      firstName: portrait.session.participant.firstName,
      eventName: event.name,
      primaryColor: event.studioConfig?.primaryColor ?? '#0B6E69',
      publicUrl: publicPortraitUrl(this.config, portrait.publicCode),
      framedImage: await this.storage.get(portrait.framedKey),
    });

    const { messageId } = await this.mail.send(message);
    await this.prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: 'SENT', providerMessageId: messageId, sentAt: new Date(), error: null },
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<SendEmailJobData> | undefined, error: Error) {
    if (!job) return;
    this.logger.error(`Email delivery ${job.data.deliveryId} failed (attempt ${job.attemptsMade}): ${error?.message}`);
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.markFailed(job.data.deliveryId, error?.message ?? 'Unknown error');
    }
  }

  private async markFailed(deliveryId: string, error: string) {
    await this.prisma.delivery
      .update({ where: { id: deliveryId }, data: { status: 'FAILED', error: error.slice(0, 500) } })
      .catch(() => undefined);
  }
}
