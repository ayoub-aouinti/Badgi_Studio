import { Module } from '@nestjs/common';
import { AdminAuth, AdminGuard } from './admin.guard';
import { AdminController, AdminEventsController } from './admin.controller';
import { AdminContentController } from './admin-content.controller';
import { AdminPortraitsService } from './admin-portraits.service';
import { AdminEventsService } from './admin-events.service';
import { AdminKiosksService } from './admin-kiosks.service';
import { AdminParticipantsService } from './admin-participants.service';
import { AdminStatsService } from './admin-stats.service';

@Module({
  controllers: [AdminController, AdminEventsController, AdminContentController],
  providers: [
    AdminAuth,
    AdminGuard,
    AdminPortraitsService,
    AdminEventsService,
    AdminKiosksService,
    AdminParticipantsService,
    AdminStatsService,
  ],
})
export class AdminModule {}
