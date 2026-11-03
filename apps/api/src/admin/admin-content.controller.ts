import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AdminStyleDto, StylePreset } from '@badgi-studio/shared';
import { BrandingService } from '../branding/branding.service';
import { UpdateBrandingDto } from '../branding/dto/update-branding.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';
import { AdminPortraitsService } from './admin-portraits.service';
import { AdminKiosksService } from './admin-kiosks.service';
import { AdminParticipantsService } from './admin-participants.service';
import { PosterService } from '../poster/poster.service';
import {
  CreateKioskDto,
  CreatePosterDto,
  ListParticipantsQuery,
  ListPortraitsQuery,
  ToggleStyleDto,
  UpdatePortraitDto,
} from './dto/admin.dto';

// Everything an organiser manages inside one event: /admin/events/:eventId/...
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/events/:eventId')
export class AdminContentController {
  constructor(
    private readonly branding: BrandingService,
    private readonly prisma: PrismaService,
    private readonly portraits: AdminPortraitsService,
    private readonly kiosks: AdminKiosksService,
    private readonly participants: AdminParticipantsService,
    private readonly poster: PosterService,
  ) {}

  // --- Branding & styles ---

  @Get('branding')
  getBranding(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.branding.get(eventId);
  }

  @Put('branding')
  updateBranding(@Param('eventId', ParseUUIDPipe) eventId: string, @Body() dto: UpdateBrandingDto) {
    return this.branding.update(eventId, dto);
  }

  @ApiConsumes('multipart/form-data')
  @Post('branding/logo')
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadLogo(@Param('eventId', ParseUUIDPipe) eventId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('logo file is required');
    await this.branding.getConfig(eventId);
    try {
      return await this.branding.setLogo(eventId, file.buffer);
    } catch {
      throw new BadRequestException('Unsupported image (use PNG, JPG, WebP or SVG)');
    }
  }

  @Delete('branding/logo')
  removeLogo(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.branding.removeLogo(eventId);
  }

  @Get('branding/preview')
  @Header('Cache-Control', 'no-store')
  async preview(@Param('eventId', ParseUUIDPipe) eventId: string, @Res() res: Response) {
    res.type('image/jpeg').send(await this.branding.preview(eventId));
  }

  @Get('styles')
  async styles(@Param('eventId', ParseUUIDPipe) eventId: string): Promise<AdminStyleDto[]> {
    const config = await this.branding.getConfig(eventId);
    const styles = await this.prisma.studioStyle.findMany({ where: { configId: config.id }, orderBy: { sortOrder: 'asc' } });
    return styles.map((style) => this.styleDto(style));
  }

  @Patch('styles/:styleId')
  async toggleStyle(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('styleId', ParseUUIDPipe) styleId: string,
    @Body() dto: ToggleStyleDto,
  ): Promise<AdminStyleDto> {
    const style = await this.prisma.studioStyle.findFirst({ where: { id: styleId, config: { eventId } } });
    if (!style) throw new NotFoundException('Style not found');
    return this.styleDto(await this.prisma.studioStyle.update({ where: { id: styleId }, data: { active: dto.active } }));
  }

  // --- Portraits & moderation ---

  @Get('portraits')
  listPortraits(@Param('eventId', ParseUUIDPipe) eventId: string, @Query() query: ListPortraitsQuery) {
    return this.portraits.list(eventId, query);
  }

  @Get('portraits.zip')
  async downloadPortraits(@Param('eventId', ParseUUIDPipe) eventId: string, @Res() res: Response) {
    await this.branding.getConfig(eventId);
    res.attachment('portraits.zip').type('application/zip');
    await this.portraits.writeZip(eventId, res);
  }

  // --- Printable poster (rendered in the background, polled by job id) ---

  @Post('poster')
  createPoster(@Param('eventId', ParseUUIDPipe) eventId: string, @Body() dto: CreatePosterDto) {
    return this.poster.enqueue(eventId, dto.format);
  }

  @Get('poster/:jobId')
  posterStatus(@Param('eventId', ParseUUIDPipe) eventId: string, @Param('jobId') jobId: string) {
    return this.poster.status(eventId, jobId);
  }

  @Patch('portraits/:portraitId')
  updatePortrait(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('portraitId', ParseUUIDPipe) portraitId: string,
    @Body() dto: UpdatePortraitDto,
  ) {
    return this.portraits.update(eventId, portraitId, dto);
  }

  // --- Kiosks ---

  @Get('kiosks')
  listKiosks(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.kiosks.list(eventId);
  }

  @Post('kiosks')
  createKiosk(@Param('eventId', ParseUUIDPipe) eventId: string, @Body() dto: CreateKioskDto) {
    return this.kiosks.create(eventId, dto.name);
  }

  @Post('kiosks/:kioskId/reset')
  resetKiosk(@Param('eventId', ParseUUIDPipe) eventId: string, @Param('kioskId', ParseUUIDPipe) kioskId: string) {
    return this.kiosks.reset(eventId, kioskId);
  }

  @Delete('kiosks/:kioskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeKiosk(@Param('eventId', ParseUUIDPipe) eventId: string, @Param('kioskId', ParseUUIDPipe) kioskId: string) {
    return this.kiosks.remove(eventId, kioskId);
  }

  // --- Participants ---

  @Get('participants')
  listParticipants(@Param('eventId', ParseUUIDPipe) eventId: string, @Query() query: ListParticipantsQuery) {
    return this.participants.list(eventId, query.q);
  }

  private styleDto(style: { id: string; name: string; preset: string; active: boolean }): AdminStyleDto {
    return { id: style.id, name: style.name, preset: style.preset as StylePreset, active: style.active };
  }
}
