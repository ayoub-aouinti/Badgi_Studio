import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Kiosk } from '@prisma/client';
import { KioskAuthGuard } from '../common/guards/kiosk-auth.guard';
import { CurrentKiosk } from '../common/decorators/current-kiosk.decorator';
import { KioskService } from './kiosk.service';
import { PairKioskDto } from './dto/pair-kiosk.dto';
import { CreateParticipantDto } from './dto/create-participant.dto';

@ApiTags('kiosk')
@Controller('kiosk')
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Post('pair')
  pair(@Body() dto: PairKioskDto) {
    return this.kioskService.pair(dto.pairingCode);
  }

  @ApiBearerAuth()
  @UseGuards(KioskAuthGuard)
  @Get('config')
  getConfig(@CurrentKiosk() kiosk: Kiosk) {
    return this.kioskService.getConfig(kiosk);
  }

  @ApiBearerAuth()
  @UseGuards(KioskAuthGuard)
  @Post('participants')
  createParticipant(@CurrentKiosk() kiosk: Kiosk, @Body() dto: CreateParticipantDto) {
    return this.kioskService.createParticipant(kiosk, dto);
  }

  @ApiBearerAuth()
  @UseGuards(KioskAuthGuard)
  @Post('portraits/:portraitId/print')
  recordPrint(@CurrentKiosk() kiosk: Kiosk, @Param('portraitId', ParseUUIDPipe) portraitId: string) {
    return this.kioskService.recordPrint(kiosk, portraitId);
  }
}
