import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import type { Event, StudioConfig } from '@prisma/client';
import type { BrandingDto, FrameStyle } from '@badgi-studio/shared';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { FrameOptions, FrameService } from '../frame/frame.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

export type ConfigWithEvent = StudioConfig & { event: Event };

const SAMPLE_PORTRAIT = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#d9e2ec"/><stop offset="1" stop-color="#9fb3c8"/></linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <circle cx="512" cy="410" r="170" fill="#486581"/>
  <ellipse cx="512" cy="1010" rx="360" ry="330" fill="#486581"/></svg>`;

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
    private readonly frame: FrameService,
  ) {}

  async getConfig(eventId: string): Promise<ConfigWithEvent> {
    const config = await this.prisma.studioConfig.findUnique({ where: { eventId }, include: { event: true } });
    if (!config) throw new NotFoundException('Event not found');
    return config;
  }

  async toDto(config: ConfigWithEvent): Promise<BrandingDto> {
    return {
      eventName: config.event.name,
      tagline: config.tagline ?? undefined,
      logoUrl: config.logoKey ? await this.storage.getUrl(config.logoKey) : undefined,
      primaryColor: config.primaryColor,
      accentColor: config.accentColor,
      frameStyle: config.frameStyle as FrameStyle,
      frameColor: config.frameColor,
      frameWidth: config.frameWidth,
      showName: config.showName,
      showLogo: config.showLogo,
    };
  }

  async get(eventId: string): Promise<BrandingDto> {
    return this.toDto(await this.getConfig(eventId));
  }

  async update(eventId: string, dto: UpdateBrandingDto): Promise<BrandingDto> {
    const config = await this.getConfig(eventId);
    const { eventName, tagline, ...rest } = dto;
    if (eventName !== undefined) {
      await this.prisma.event.update({ where: { id: config.eventId }, data: { name: eventName } });
    }
    await this.prisma.studioConfig.update({
      where: { id: config.id },
      data: { ...rest, ...(tagline !== undefined && { tagline: tagline.trim() || null }) },
    });
    return this.get(eventId);
  }

  async setLogo(eventId: string, file: Buffer): Promise<BrandingDto> {
    const config = await this.getConfig(eventId);
    // Normalised to a bounded PNG so the frame, wall and kiosk all get the same asset.
    const png = await sharp(file)
      .rotate()
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const key = `branding/logo-${randomUUID()}.png`;
    await this.storage.put(key, png, 'image/png');
    await this.prisma.studioConfig.update({ where: { id: config.id }, data: { logoKey: key } });
    return this.get(eventId);
  }

  async removeLogo(eventId: string): Promise<BrandingDto> {
    const config = await this.getConfig(eventId);
    await this.prisma.studioConfig.update({ where: { id: config.id }, data: { logoKey: null } });
    return this.get(eventId);
  }

  // Frame options for a portrait; the participant name only appears when the admin allows it.
  async frameOptions(config: ConfigWithEvent, participantName?: string): Promise<FrameOptions> {
    return {
      style: config.frameStyle as FrameStyle,
      color: config.frameColor,
      width: config.frameWidth,
      accentColor: config.accentColor,
      participantName: config.showName ? participantName : undefined,
      eventName: config.event.name,
      tagline: config.tagline ?? undefined,
      logo: config.showLogo && config.logoKey ? await this.storage.get(config.logoKey) : undefined,
    };
  }

  // Live preview for the admin page: a stand-in portrait framed with the saved branding.
  async preview(eventId: string): Promise<Buffer> {
    const config = await this.getConfig(eventId);
    const sample = await sharp(Buffer.from(SAMPLE_PORTRAIT)).jpeg().toBuffer();
    return this.frame.apply(sample, await this.frameOptions(config, 'Prénom Nom'));
  }
}
