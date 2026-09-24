import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface FrameOptions {
  participantName: string;
  eventName: string;
  sponsorName?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class FrameService {
  // Composites a bottom banner (participant name, congress, sponsor) over the generated
  // portrait, per docs/SCREENS.md "portrait encadré" (name, congress, sponsor).
  async apply(image: Buffer, options: FrameOptions): Promise<Buffer> {
    const base = sharp(image).resize(1024, 1024, { fit: 'cover' });
    const metadata = await base.metadata();
    const width = metadata.width ?? 1024;
    const bannerHeight = 140;

    const svg = `
      <svg width="${width}" height="${bannerHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="${bannerHeight}" fill="#0E1B2C" fill-opacity="0.92" />
        <text x="32" y="55" font-family="Bricolage Grotesque, Arial, sans-serif" font-size="36" font-weight="800" fill="#FFFFFF">${escapeXml(
          options.participantName,
        )}</text>
        <text x="32" y="95" font-family="Figtree, Arial, sans-serif" font-size="22" fill="#5FD3C8">${escapeXml(
          options.eventName,
        )}</text>
        ${
          options.sponsorName
            ? `<text x="32" y="125" font-family="Figtree, Arial, sans-serif" font-size="18" fill="#C9D2D0">Offert par ${escapeXml(
                options.sponsorName,
              )}</text>`
            : ''
        }
      </svg>
    `;

    return base
      .composite([{ input: Buffer.from(svg), gravity: 'south' }])
      .jpeg({ quality: 92 })
      .toBuffer();
  }
}
