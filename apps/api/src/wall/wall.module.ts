import { Module } from '@nestjs/common';
import { WallController } from './wall.controller';
import { WallService } from './wall.service';

@Module({
  controllers: [WallController],
  providers: [WallService],
})
export class WallModule {}
