import { Module } from '@nestjs/common';
import { PurgeService } from './purge.service';
import { PurgeProcessor } from './purge.processor';

@Module({
  providers: [PurgeService, PurgeProcessor],
  exports: [PurgeService],
})
export class PurgeModule {}
