import { Module } from '@nestjs/common';
import { PortraitsController } from './portraits.controller';
import { PortraitsService } from './portraits.service';
import { PortraitGenerationProcessor } from './portrait-generation.processor';
import { SketchService } from '../sketch/sketch.service';
import { BackgroundRemovalService } from '../segmentation/background-removal.service';
import { DeliveriesModule } from '../deliveries/deliveries.module';

@Module({
  imports: [DeliveriesModule],
  controllers: [PortraitsController],
  providers: [
    PortraitsService,
    PortraitGenerationProcessor,
    SketchService,
    BackgroundRemovalService,
  ],
  exports: [PortraitsService],
})
export class PortraitsModule {}
