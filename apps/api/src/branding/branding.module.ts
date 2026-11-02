import { Global, Module } from '@nestjs/common';
import { FrameService } from '../frame/frame.service';
import { BrandingService } from './branding.service';

@Global()
@Module({
  providers: [BrandingService, FrameService],
  exports: [BrandingService, FrameService],
})
export class BrandingModule {}
