import { Module } from '@nestjs/common';
import { GalleryController, PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  controllers: [PublicController, GalleryController],
  providers: [PublicService],
})
export class PublicModule {}
