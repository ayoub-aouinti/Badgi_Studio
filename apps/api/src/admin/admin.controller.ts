import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { BrandingService } from '../branding/branding.service';
import { UpdateBrandingDto } from '../branding/dto/update-branding.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuth, AdminGuard } from './admin.guard';
import { AdminPortraitsService } from './admin-portraits.service';

class LoginDto {
  @IsString()
  password!: string;
}

class ToggleStyleDto {
  @IsBoolean()
  active!: boolean;
}

class UpdatePortraitDto {
  @IsOptional()
  @IsBoolean()
  onWall?: boolean;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly auth: AdminAuth,
    private readonly branding: BrandingService,
    private readonly prisma: PrismaService,
    private readonly portraits: AdminPortraitsService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return { token: this.auth.login(dto.password) };
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Get('branding')
  getBranding() {
    return this.branding.get();
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Put('branding')
  updateBranding(@Body() dto: UpdateBrandingDto) {
    return this.branding.update(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiConsumes('multipart/form-data')
  @Post('branding/logo')
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('logo file is required');
    try {
      return await this.branding.setLogo(file.buffer);
    } catch {
      throw new BadRequestException('Unsupported image (use PNG, JPG, WebP or SVG)');
    }
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Delete('branding/logo')
  removeLogo() {
    return this.branding.removeLogo();
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Get('branding/preview')
  @Header('Cache-Control', 'no-store')
  async preview(@Res() res: Response) {
    res.type('image/jpeg').send(await this.branding.preview());
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Get('styles')
  async styles() {
    const config = await this.branding.getActive();
    return this.prisma.studioStyle.findMany({
      where: { configId: config.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, preset: true, active: true },
    });
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Patch('styles/:id')
  toggleStyle(@Param('id') id: string, @Body() dto: ToggleStyleDto) {
    return this.prisma.studioStyle.update({
      where: { id },
      data: { active: dto.active },
      select: { id: true, name: true, preset: true, active: true },
    });
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Get('portraits')
  listPortraits() {
    return this.portraits.list();
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Patch('portraits/:id')
  updatePortrait(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePortraitDto) {
    return this.portraits.update(id, dto);
  }
}
