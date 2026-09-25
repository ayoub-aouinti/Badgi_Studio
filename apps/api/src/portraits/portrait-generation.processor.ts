import { Inject, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { PortraitProgressStep } from '@badgi-studio/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROVIDER, AiProvider } from '../ai/ai-provider.interface';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { FrameService } from '../frame/frame.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PORTRAIT_GENERATION_QUEUE } from '../queue/queue.module';

interface GenerateJobData {
  portraitId: string;
}

// docs/SPEC.md §Génération + docs/SCREENS.md écran 6b (étapes sketch/ink/color/frame).
@Processor(PORTRAIT_GENERATION_QUEUE)
export class PortraitGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(PortraitGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
    private readonly frameService: FrameService,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<GenerateJobData>): Promise<void> {
    const portrait = await this.prisma.portrait.findUniqueOrThrow({
      where: { id: job.data.portraitId },
      include: {
        style: true,
        session: {
          include: {
            participant: true,
            kiosk: { include: { event: { include: { studioConfig: true } } } },
          },
        },
      },
    });

    const { session } = portrait;
    const event = session.kiosk.event;
    const studioConfig = event.studioConfig;

    await this.setStatus(portrait.id, 'MODERATING');
    this.emitProgress(portrait.id, session.id, 'sketch');
    // AI_PROVIDER=mock: no real face/content detector, always accepted (docs/SPEC.md).

    await this.setStatus(portrait.id, 'GENERATING');
    this.emitProgress(portrait.id, session.id, 'ink');

    const selfieBuffer = await this.storage.get(portrait.selfieKey);
    const generated = await this.aiProvider.generate(selfieBuffer, portrait.style);

    this.emitProgress(portrait.id, session.id, 'color');
    const resultKey = `portraits/${session.id}/${randomUUID()}-result.jpg`;
    await this.storage.put(resultKey, generated, 'image/jpeg');

    const framed = await this.frameService.apply(generated, {
      participantName: `${session.participant.firstName} ${session.participant.lastName}`,
      eventName: event.name,
      sponsorName: studioConfig?.sponsorName ?? undefined,
    });
    this.emitProgress(portrait.id, session.id, 'frame');
    const framedKey = `portraits/${session.id}/${randomUUID()}-framed.jpg`;
    await this.storage.put(framedKey, framed, 'image/jpeg');

    // The wall is opt-in (docs/SPEC.md: 3 separate consents — ai_processing/wall/sponsor).
    // Look up the participant's latest WALL consent rather than assuming it was granted.
    const wallConsent = await this.prisma.consent.findFirst({
      where: { participantId: session.participantId, type: 'WALL' },
      orderBy: { grantedAt: 'desc' },
    });
    const onWall = wallConsent?.granted ?? false;

    await this.prisma.portrait.update({
      where: { id: portrait.id },
      data: { status: 'READY', resultKey, framedKey, onWall },
    });

    const [resultUrl, framedUrl] = await Promise.all([
      this.storage.getUrl(resultKey),
      this.storage.getUrl(framedKey),
    ]);

    this.realtime.emitPortraitReady({
      portraitId: portrait.id,
      sessionId: session.id,
      publicCode: portrait.publicCode,
      resultUrl,
      framedUrl,
    });

    if (onWall) {
      this.realtime.emitWallNew({
        portraitId: portrait.id,
        framedUrl,
        participantName: session.participant.firstName,
        specialty: session.participant.specialty ?? undefined,
      });
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<GenerateJobData> | undefined) {
    if (!job) return;
    this.logger.error(`Portrait generation failed for ${job.data.portraitId} (attempt ${job.attemptsMade})`);
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (exhausted) {
      await this.prisma.portrait
        .update({ where: { id: job.data.portraitId }, data: { status: 'FAILED' } })
        .catch(() => undefined);
    }
  }

  private async setStatus(portraitId: string, status: 'MODERATING' | 'GENERATING') {
    await this.prisma.portrait.update({ where: { id: portraitId }, data: { status } });
  }

  private emitProgress(portraitId: string, sessionId: string, step: PortraitProgressStep) {
    this.realtime.emitPortraitProgress({ portraitId, sessionId, step });
  }
}
