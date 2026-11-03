import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { MEDIA_QUEUE } from '../queue/queue.module';
import { DrawingVideoRenderer } from './drawing-video';

export const RENDER_VIDEO_JOB = 'render-video';

export interface RenderVideoJobData {
  portraitId: string;
}

// FFMPEG_PATH, else the binary shipped by the ffmpeg-static package (free, no system install).
function ffmpegPath(config: ConfigService): string | null {
  const configured = config.get<string>('FFMPEG_PATH');
  if (configured) return configured;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (require('ffmpeg-static') as string | null) ?? null;
  } catch {
    return null;
  }
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly renderer: DrawingVideoRenderer | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
    @InjectQueue(MEDIA_QUEUE) private readonly queue: Queue,
  ) {
    const path = config.get<string>('VIDEO_ENABLED') === 'false' ? null : ffmpegPath(config);
    this.renderer = path ? new DrawingVideoRenderer(path) : null;
    if (!this.renderer) this.logger.warn('Drawing videos disabled (VIDEO_ENABLED=false or no ffmpeg)');
  }

  async enqueue(portraitId: string): Promise<void> {
    if (!this.renderer) return;
    await this.queue.add(RENDER_VIDEO_JOB, { portraitId } satisfies RenderVideoJobData);
  }

  async render(portraitId: string): Promise<void> {
    if (!this.renderer) return;
    const portrait = await this.prisma.portrait.findUnique({ where: { id: portraitId } });
    const { sketchKey, resultKey, framedKey } = portrait ?? {};
    // No trace (tracing failed) = no drawing to replay; purged = nothing to render.
    if (!portrait || portrait.purgedAt || portrait.videoKey || !sketchKey || !resultKey || !framedKey) return;

    const [sketch, color, framed] = await Promise.all([
      this.storage.get(sketchKey),
      this.storage.get(resultKey),
      this.storage.get(framedKey),
    ]);
    const video = await this.renderer.render({ sketchSvg: sketch.toString('utf-8'), color, framed });

    const videoKey = `portraits/${portrait.sessionId}/${randomUUID()}-drawing.mp4`;
    await this.storage.put(videoKey, video, 'video/mp4');
    // Only attach it if the portrait was not purged meanwhile (else the file would leak).
    const { count } = await this.prisma.portrait.updateMany({
      where: { id: portraitId, purgedAt: null },
      data: { videoKey },
    });
    if (!count) await this.storage.delete(videoKey);
  }
}
