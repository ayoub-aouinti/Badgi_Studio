import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { StorageModule } from './storage/storage.module';
import { AiProviderModule } from './ai/ai-provider.module';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';
import { KioskModule } from './kiosk/kiosk.module';
import { SessionsModule } from './sessions/sessions.module';
import { PortraitsModule } from './portraits/portraits.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Root .env is the single source of truth (shared with docker-compose);
      // apps/api/.env can still override locally if present.
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    StorageModule,
    AiProviderModule,
    QueueModule,
    RealtimeModule,
    KioskModule,
    SessionsModule,
    PortraitsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
