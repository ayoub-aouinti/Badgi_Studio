import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Kiosk } from '@prisma/client';
import { KioskAuthGuard } from '../common/guards/kiosk-auth.guard';
import { CurrentKiosk } from '../common/decorators/current-kiosk.decorator';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';

@ApiTags('kiosk')
@ApiBearerAuth()
@UseGuards(KioskAuthGuard)
@Controller('kiosk/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@CurrentKiosk() kiosk: Kiosk, @Body() dto: CreateSessionDto) {
    return this.sessionsService.createSession(kiosk, dto);
  }
}
