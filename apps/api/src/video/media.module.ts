import { Global, Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { MediaProcessor } from './media.processor';
import { PosterService } from '../poster/poster.service';

@Global()
@Module({
  providers: [VideoService, PosterService, MediaProcessor],
  exports: [VideoService, PosterService],
})
export class MediaModule {}
