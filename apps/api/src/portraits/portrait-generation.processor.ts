import { Inject, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { PortraitProgressStep } from '@badgi-studio/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROVIDER, AiProvider } from '../ai/ai-provider.interface';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { FrameService } from '../frame/frame.service';
import { BrandingService } from '../branding/branding.service';
import { SketchService } from '../sketch/sketch.service';
import { BackgroundRemovalService } from '../segmentation/background-removal.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { VideoService } from '../video/video.service';
import { CONTENT_MODERATOR, ContentModerator } from '../moderation/content-moderator.interface';
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
    private readonly branding: BrandingService,
    private readonly sketchService: SketchService,
    private readonly backgroundRemoval: BackgroundRemovalService,
    private readonly realtime: RealtimeGateway,
    private readonly deliveries: DeliveriesService,
    @Inject(CONTENT_MODERATOR) private readonly moderator: ContentModerator,
    private readonly video: VideoService,
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

    if (!portrait.selfieKey) {
      throw new Error(`Portrait ${portrait.id} has no selfie (purged)`);
    }
    const selfieBuffer = await this.storage.get(portrait.selfieKey);

    await this.setStatus(portrait.id, 'MODERATING');
    this.emitProgress(portrait.id, session.id, 'sketch');
    // Refused selfies are never sent to the AI provider nor shown anywhere; the kiosk asks
    // the participant to retake the photo.
    const verdict = await this.moderator.check(selfieBuffer);
    if (verdict.flagged) {
      await this.prisma.portrait.update({
        where: { id: portrait.id },
        data: { status: 'REJECTED', moderation: 'REJECTED', moderationReason: verdict.reason, moderatedAt: new Date() },
      });
      this.realtime.emitPortraitRejected({ portraitId: portrait.id, sessionId: session.id });
      return;
    }

    await this.setStatus(portrait.id, 'GENERATING');
    this.emitProgress(portrait.id, session.id, 'ink');

    // Person on a plain background: both the styling and the traced line art should be
    // about the participant, not whatever was behind them at the venue.
    const subject = await this.backgroundRemoval.removeBackground(selfieBuffer);
    const generated = await this.aiProvider.generate(subject.image, portrait.style);

    this.emitProgress(portrait.id, session.id, 'color');
    const resultKey = `portraits/${session.id}/${randomUUID()}-result.jpg`;
    await this.storage.put(resultKey, generated.image, 'image/jpeg');

    const [framed, sketchSvg] = await Promise.all([
      this.branding
        .frameOptions(
          { ...event.studioConfig!, event },
          `${session.participant.firstName} ${session.participant.lastName}`,
        )
        .then((options) => this.frameService.apply(generated.image, options)),
      // An illustration is traced directly (clean contours, like inking your own drawing).
      // A retouched photo is traced from the cutout instead: the mock grading adds its own
      // vignette/median/tint, which washed out the face in testing. Either way the source is
      // a centered square of the same framing as `generated`, so the colour pass lines up.
      // When the provider changed the geometry (warp, generative model) it hands back its own
      // photo-like source for that reason.
      generated.illustration
        ? this.sketchService.traceToSvg(generated.image, 'illustration')
        : this.sketchService.traceToSvg(
            generated.lineArtSource ?? subject.image,
            subject.isolated ? 'isolated' : 'photo',
          ),
    ]);
    this.emitProgress(portrait.id, session.id, 'frame');
    const framedKey = `portraits/${session.id}/${randomUUID()}-framed.jpg`;
    await this.storage.put(framedKey, framed, 'image/jpeg');

    let sketchKey: string | undefined;
    if (sketchSvg) {
      sketchKey = `portraits/${session.id}/${randomUUID()}-sketch.svg`;
      await this.storage.put(sketchKey, Buffer.from(sketchSvg), 'image/svg+xml');
    }

    // The wall is opt-in (docs/SPEC.md: 3 separate consents — ai_processing/wall/sponsor).
    // Look up the participant's latest WALL consent rather than assuming it was granted.
    const wallConsent = await this.prisma.consent.findFirst({
      where: { participantId: session.participantId, type: 'WALL' },
      orderBy: { grantedAt: 'desc' },
    });
    // With pre-moderation, a consenting participant's portrait waits for the organiser.
    const wallWanted = wallConsent?.granted ?? false;
    const preModeration = event.studioConfig?.preModeration ?? false;
    const onWall = wallWanted && !preModeration;

    await this.prisma.portrait.update({
      where: { id: portrait.id },
      data: {
        status: 'READY',
        resultKey,
        framedKey,
        sketchKey,
        onWall,
        moderation: wallWanted && preModeration ? 'PENDING' : 'NOT_REQUIRED',
        providerRequestId: generated.providerRequestId,
        costUsd: generated.costUsd,
      },
    });

    const [resultUrl, framedUrl, sketchUrl] = await Promise.all([
      this.storage.getUrl(resultKey),
      this.storage.getUrl(framedKey),
      sketchKey ? this.storage.getUrl(sketchKey) : Promise.resolve(undefined),
    ]);

    this.realtime.emitPortraitReady({
      portraitId: portrait.id,
      sessionId: session.id,
      publicCode: portrait.publicCode,
      resultUrl,
      framedUrl,
      sketchUrl,
    });

    if (onWall) {
      this.realtime.emitWallNew(event.id, {
        portraitId: portrait.id,
        framedUrl,
        resultUrl,
        sketchUrl,
        participantName: session.participant.firstName,
      });
    }

    // The portrait is already READY: a delivery problem must not re-run the generation job.
    await this.deliveries.enqueueForPortrait(portrait.id).catch((error: Error) => {
      this.logger.error(`Could not enqueue deliveries for ${portrait.id}: ${error.message}`);
    });
    await this.video.enqueue(portrait.id).catch((error: Error) => {
      this.logger.error(`Could not enqueue the drawing video for ${portrait.id}: ${error.message}`);
    });
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
