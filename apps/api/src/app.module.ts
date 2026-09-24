import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Root .env is the single source of truth (shared with docker-compose);
      // apps/api/.env can still override locally if present.
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
