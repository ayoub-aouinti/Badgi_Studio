import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PublicService } from './public.service';
import { renderGalleryPage, renderNotFoundPage, renderPortraitPage } from './public-page';

// Byte range of a "Range: bytes=start-end" header, or null to send the whole file. Safari
// (iOS) only plays a <video> whose server answers range requests.
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  let start = match[1] ? parseInt(match[1], 10) : NaN;
  let end = match[2] ? parseInt(match[2], 10) : size - 1;
  if (Number.isNaN(start)) {
    // "bytes=-500": the last 500 bytes.
    start = Math.max(0, size - end);
    end = size - 1;
  }
  end = Math.min(end, size - 1);
  return start <= end && start < size ? { start, end } : 'invalid';
}

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

  @Get(':code/video')
  async video(
    @Param('code') code: string,
    @Query('download') download: string | undefined,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ) {
    const file = await this.publicService.getVideo(code);
    if (!file) {
      res.status(404).type('html').send(renderNotFoundPage());
      return;
    }
    const size = file.video.length;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Accept-Ranges', 'bytes');
    res.type('video/mp4');
    if (download) res.attachment(file.filename);

    const range = parseRange(rangeHeader, size);
    if (range === 'invalid') {
      res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
      return;
    }
    if (!range) {
      res.send(file.video);
      return;
    }
    res.status(206).setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    res.send(file.video.subarray(range.start, range.end + 1));
  }
}

// Public online gallery of an event, when the organiser enabled it (unguessable token).
@ApiTags('public')
@Controller('g')
export class GalleryController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':token')
  async gallery(@Param('token') token: string, @Res() res: Response) {
    const data = await this.publicService.getGallery(token);
    res.setHeader('Cache-Control', 'no-store');
    if (!data) {
      res.status(404).type('html').send(renderNotFoundPage());
      return;
    }
    res.type('html').send(renderGalleryPage(data));
  }
}
