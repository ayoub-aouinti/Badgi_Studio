import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Kiosk } from '@prisma/client';
import { KioskAuthGuard } from '../common/guards/kiosk-auth.guard';
import { CurrentKiosk } from '../common/decorators/current-kiosk.decorator';
import { PortraitsService } from './portraits.service';
import { CreatePortraitDto } from './dto/create-portrait.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SELFIE_SIZE = 10 * 1024 * 1024;

@ApiTags('kiosk')
@ApiBearerAuth()
@UseGuards(KioskAuthGuard)
@Controller('kiosk/sessions/:sessionId/portraits')
export class PortraitsController {
  constructor(private readonly portraitsService: PortraitsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        selfie: { type: 'string', format: 'binary' },
        styleId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('selfie', {
      limits: { fileSize: MAX_SELFIE_SIZE },
      fileFilter: (_req, file, callback) => {
        callback(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
      },
    }),
  )
  create(
    @CurrentKiosk() kiosk: Kiosk,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreatePortraitDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.portraitsService.createPortrait(kiosk, sessionId, dto, file);
  }
}
