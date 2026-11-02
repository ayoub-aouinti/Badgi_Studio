import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MAINTENANCE_QUEUE } from '../queue/queue.module';
import { PurgeResult, PurgeService } from './purge.service';

const PURGE_SCHEDULER_ID = 'purge-expired-portraits';

@Processor(MAINTENANCE_QUEUE)
export class PurgeProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly purge: PurgeService,
    private readonly config: ConfigService,
    @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  // Upserted on every boot, so several API instances still share a single schedule.
  async onModuleInit() {
    const minutes = Math.max(1, parseInt(this.config.get<string>('PURGE_INTERVAL_MINUTES') ?? '60', 10) || 60);
    await this.queue.upsertJobScheduler(PURGE_SCHEDULER_ID, { every: minutes * 60 * 1000 }, { name: 'purge' });
  }

  process(): Promise<PurgeResult> {
    return this.purge.purgeDue();
  }
}
