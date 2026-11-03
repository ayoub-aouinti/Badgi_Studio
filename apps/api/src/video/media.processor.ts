import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MEDIA_QUEUE } from '../queue/queue.module';
import { RENDER_VIDEO_JOB, RenderVideoJobData, VideoService } from './video.service';
import { POSTER_JOB, PosterJobData, PosterResult, PosterService } from '../poster/poster.service';

// One worker for the slow, optional media renders.
@Processor(MEDIA_QUEUE)
export class MediaProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    private readonly video: VideoService,
    private readonly poster: PosterService,
  ) {
    super();
  }

  async process(job: Job<RenderVideoJobData | PosterJobData>): Promise<PosterResult | void> {
    if (job.name === RENDER_VIDEO_JOB) return this.video.render((job.data as RenderVideoJobData).portraitId);
    if (job.name === POSTER_JOB) return this.poster.render(job.data as PosterJobData);
    throw new Error(`Unknown media job ${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    if (job) this.logger.error(`Media job ${job.name} ${job.id} failed: ${error?.message}`);
  }
}
