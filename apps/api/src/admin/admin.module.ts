import { Module } from '@nestjs/common';
import { AdminAuth, AdminGuard } from './admin.guard';
import { AdminController } from './admin.controller';

@Module({
  controllers: [AdminController],
  providers: [AdminAuth, AdminGuard],
})
export class AdminModule {}
