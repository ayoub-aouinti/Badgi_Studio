import { Module } from '@nestjs/common';
import { PortraitsController } from './portraits.controller';
import { PortraitsService } from './portraits.service';
import { PortraitGenerationProcessor } from './portrait-generation.processor';
import { FrameService } from '../frame/frame.service';
import { SketchService } from '../sketch/sketch.service';

@Module({
  controllers: [PortraitsController],
  providers: [PortraitsService, PortraitGenerationProcessor, FrameService, SketchService],
  exports: [PortraitsService],
})
export class PortraitsModule {}
