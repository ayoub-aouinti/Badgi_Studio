import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PublicService } from './public.service';
import { renderNotFoundPage, renderPortraitPage } from './public-page';

// Public: the unguessable code is the secret (docs/SPEC.md §API: GET /p/:code).
@ApiTags('public')
@Controller('p')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':code')
  async page(@Param('code') code: string, @Res() res: Response) {
    const data = await this.publicService.getPage(code);
    res.setHeader('Cache-Control', 'no-store');
    if (!data) {
      res.status(404).type('html').send(renderNotFoundPage());
      return;
    }
    res.type('html').send(renderPortraitPage(data));
  }

  @Get(':code/image')
  async image(@Param('code') code: string, @Query('download') download: string | undefined, @Res() res: Response) {
    const file = await this.publicService.getImage(code);
    if (!file) {
      res.status(404).type('html').send(renderNotFoundPage());
      return;
    }
    // no-store: a purged portrait must stop being served, including from caches.
    res.setHeader('Cache-Control', 'no-store');
    if (download) res.attachment(file.filename);
    res.type('image/jpeg').send(file.image);
  }
}
