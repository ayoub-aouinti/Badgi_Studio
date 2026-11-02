import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const PORTRAIT_GENERATION_QUEUE = 'portrait-generation';
export const DELIVERY_QUEUE = 'delivery';
export const MAINTENANCE_QUEUE = 'maintenance';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: PORTRAIT_GENERATION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    // docs/SPEC.md §Envois: on failure, 1 retry then the delivery is marked failed.
    BullModule.registerQueue({
      name: DELIVERY_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
    BullModule.registerQueue({
      name: MAINTENANCE_QUEUE,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 20 },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
