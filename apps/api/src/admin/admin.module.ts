import { Module } from '@nestjs/common';
import { AdminAuth, AdminGuard } from './admin.guard';
import { AdminController } from './admin.controller';
import { AdminPortraitsService } from './admin-portraits.service';

@Module({
  controllers: [AdminController],
  providers: [AdminAuth, AdminGuard, AdminPortraitsService],
})
export class AdminModule {}
