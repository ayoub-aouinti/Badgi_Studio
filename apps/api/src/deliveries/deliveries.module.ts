import { Module } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { DeliveryProcessor } from './delivery.processor';

@Module({
  providers: [DeliveriesService, DeliveryProcessor],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
