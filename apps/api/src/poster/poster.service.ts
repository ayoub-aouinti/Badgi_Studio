import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import { randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import type { PosterFormat, PosterJobDto } from '@badgi-studio/shared';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageService } from '../storage/storage.interface';
import { BrandingService } from '../branding/branding.service';
import { MEDIA_QUEUE } from '../queue/queue.module';

export const POSTER_JOB = 'render-poster';

export interface PosterJobData {
  eventId: string;
  format: PosterFormat;
}

export interface PosterResult {
  imageKey: string;
  pdfKey: string;
  count: number;
}

const DPI = 150;
const MM_PER_INCH = 25.4;
// ISO 216 portrait sizes in millimetres.
const PAPER_MM: Record<PosterFormat, [number, number]> = {
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Largest square tile for `count` tiles in a width x height area (gap included).
export function gridLayout(count: number, width: number, height: number, gap: number) {
  let best = { columns: 1, rows: count, tile: 0 };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const tile = Math.floor(Math.min((width - gap * (columns - 1)) / columns, (height - gap * (rows - 1)) / rows));
    if (tile > best.tile) best = { columns, rows, tile };
  }
  return best;
}

// The printable "mur" (docs: poster/mosaic export): every portrait shown on the wall, under
// the congress banner, as a 150 dpi JPEG and a PDF of the same page.
@Injectable()
export class PosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branding: BrandingService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageService,
    @InjectQueue(MEDIA_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueue(eventId: string, format: PosterFormat): Promise<PosterJobDto> {
    await this.branding.getConfig(eventId);
    const job = await this.queue.add(POSTER_JOB, { eventId, format } satisfies PosterJobData);
    return { jobId: job.id!, status: 'waiting' };
  }

  async status(eventId: string, jobId: string): Promise<PosterJobDto> {
    const job = (await this.queue.getJob(jobId)) as Job<PosterJobData, PosterResult> | undefined;
    if (!job || job.name !== POSTER_JOB || job.data.eventId !== eventId) throw new NotFoundException('Poster job not found');
    const state = await job.getState();
    if (state === 'completed' && job.returnvalue) {
      const { imageKey, pdfKey, count } = job.returnvalue;
      return {
        jobId,
        status: 'completed',
        count,
        imageUrl: await this.storage.getUrl(imageKey),
        pdfUrl: await this.storage.getUrl(pdfKey),
      };
    }
    if (state === 'failed') return { jobId, status: 'failed', error: job.failedReason };
    return { jobId, status: state === 'active' ? 'active' : 'waiting' };
  }

  async render({ eventId, format }: PosterJobData): Promise<PosterResult> {
    const config = await this.branding.getConfig(eventId);
    const portraits = await this.prisma.portrait.findMany({
      where: { session: { kiosk: { eventId } }, onWall: true, purgedAt: null, framedKey: { not: null } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'asc' }],
      select: { framedKey: true },
    });
    // Retrying cannot help: fail the job at once.
    if (!portraits.length) throw new UnrecoverableError('No portrait on the wall yet');

    const [mmWidth, mmHeight] = PAPER_MM[format];
    const width = Math.round((mmWidth / MM_PER_INCH) * DPI);
    const height = Math.round((mmHeight / MM_PER_INCH) * DPI);
    const margin = Math.round(width * 0.04);
    const headerHeight = Math.round(height * 0.11);
    const footerHeight = Math.round(height * 0.03);
    const gap = Math.round(width * 0.008);

    const area = { width: width - margin * 2, height: height - headerHeight - footerHeight - margin * 2 };
    const { columns, rows, tile } = gridLayout(portraits.length, area.width, area.height, gap);
    // Centre the grid in the area.
    const left0 = margin + Math.round((area.width - (columns * tile + (columns - 1) * gap)) / 2);
    const top0 = headerHeight + margin + Math.round((area.height - (rows * tile + (rows - 1) * gap)) / 2);

    const tiles = await Promise.all(
      portraits.map(async ({ framedKey }, i) => ({
        input: await sharp(await this.storage.get(framedKey!)).resize(tile, tile, { fit: 'cover' }).jpeg().toBuffer(),
        left: left0 + (i % columns) * (tile + gap),
        top: top0 + Math.floor(i / columns) * (tile + gap),
      })),
    );

    const layers: sharp.OverlayOptions[] = [{ input: Buffer.from(this.headerSvg(config, width, headerHeight, margin)), left: 0, top: 0 }];
    if (config.logoKey) {
      const logoHeight = Math.round(headerHeight * 0.6);
      const logo = await sharp(await this.storage.get(config.logoKey))
        .resize({ height: logoHeight, width: Math.round(width * 0.25), fit: 'inside' })
        .png()
        .toBuffer();
      const { width: logoWidth = 0 } = await sharp(logo).metadata();
      layers.push({ input: logo, left: width - margin - logoWidth, top: Math.round((headerHeight - logoHeight) / 2) });
    }
    layers.push(...tiles);
    layers.push({
      input: Buffer.from(
        `<svg width="${width}" height="${footerHeight}" xmlns="http://www.w3.org/2000/svg">` +
          `<text x="${width / 2}" y="${footerHeight * 0.6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(footerHeight * 0.4)}" fill="#52606D">` +
          `${portraits.length} portraits</text></svg>`,
      ),
      left: 0,
      top: height - footerHeight,
    });

    const image = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
      .composite(layers)
      .jpeg({ quality: 88 })
      .withMetadata({ density: DPI })
      .toBuffer();
    const pdf = await this.toPdf(image, mmWidth, mmHeight);

    const base = `posters/${eventId}/${randomUUID()}-${format}`;
    await Promise.all([
      this.storage.put(`${base}.jpg`, image, 'image/jpeg'),
      this.storage.put(`${base}.pdf`, pdf, 'application/pdf'),
    ]);
    return { imageKey: `${base}.jpg`, pdfKey: `${base}.pdf`, count: portraits.length };
  }

  private headerSvg(
    config: { primaryColor: string; tagline: string | null; event: { name: string } },
    width: number,
    height: number,
    margin: number,
  ): string {
    const color = /^#[0-9a-fA-F]{6}$/.test(config.primaryColor) ? config.primaryColor : '#0B6E69';
    const title = Math.round(height * 0.3);
    return (
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="${color}"/>` +
      `<text x="${margin}" y="${height * 0.5}" font-family="Arial, sans-serif" font-weight="bold" font-size="${title}" fill="#ffffff">${escapeXml(config.event.name)}</text>` +
      (config.tagline
        ? `<text x="${margin}" y="${height * 0.5 + title * 0.95}" font-family="Arial, sans-serif" font-size="${Math.round(title * 0.5)}" fill="#ffffff" fill-opacity="0.85">${escapeXml(config.tagline)}</text>`
        : '') +
      `</svg>`
    );
  }

  private toPdf(image: Buffer, mmWidth: number, mmHeight: number): Promise<Buffer> {
    const points = (mm: number) => (mm / MM_PER_INCH) * 72;
    const doc = new PDFDocument({ size: [points(mmWidth), points(mmHeight)], margin: 0, info: { Title: 'Mur des portraits' } });
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.image(image, 0, 0, { width: points(mmWidth), height: points(mmHeight) });
      doc.end();
    });
  }
}
