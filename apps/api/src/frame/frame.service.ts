import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import type { FrameStyle } from '@badgi-studio/shared';

export interface FrameOptions {
  style: FrameStyle;
  color: string;
  width: number;
  accentColor: string;
  participantName?: string;
  eventName: string;
  tagline?: string;
  logo?: Buffer;
}

const SIZE = 1024;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Dark or white text, whichever reads better on the given hex colour.
function contrastOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const luminance = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luminance > 150 ? '#0E1B2C' : '#FFFFFF';
}

@Injectable()
export class FrameService {
  // Wraps a generated portrait in the organiser frame configured in the admin Branding page.
  async apply(image: Buffer, options: FrameOptions): Promise<Buffer> {
    const portrait = sharp(image).resize(SIZE, SIZE, { fit: 'cover' });

    if (options.style === 'none') {
      const layers = options.logo ? [await this.logoLayer(options.logo, 150, SIZE - 28, 28)] : [];
      return portrait.composite(layers).jpeg({ quality: 92 }).toBuffer();
    }

    const ink = contrastOn(options.color);
    const caption = this.captionHeight(options);

    // "banner" overlays the bottom of the portrait; "border" / "polaroid" extend the canvas.
    if (options.style === 'banner') {
      const layers: sharp.OverlayOptions[] = [
        { input: Buffer.from(this.captionSvg(options, SIZE, caption, ink, 0.92)), gravity: 'south' },
      ];
      if (options.logo) {
        layers.push(await this.logoLayer(options.logo, 110, SIZE - 24, SIZE - caption + 16));
      }
      return portrait.composite(layers).jpeg({ quality: 92 }).toBuffer();
    }

    const border = Math.max(8, Math.min(options.width, 96));
    const bottom = border + (options.style === 'polaroid' ? Math.max(caption, 170) : caption);
    const totalW = SIZE + border * 2;
    const totalH = SIZE + border + bottom;
    const layers: sharp.OverlayOptions[] = [
      { input: await portrait.toBuffer(), left: border, top: border },
      {
        input: Buffer.from(this.captionSvg(options, totalW - border * 2, bottom - border, ink)),
        left: border,
        top: SIZE + border,
      },
    ];
    if (options.logo) {
      layers.push(await this.logoLayer(options.logo, 120, totalW - border - 24, SIZE + border + 16));
    }
    return sharp({ create: { width: totalW, height: totalH, channels: 3, background: options.color } })
      .composite(layers)
      .jpeg({ quality: 92 })
      .toBuffer();
  }

  private captionHeight(options: FrameOptions): number {
    const lines = (options.participantName ? 1 : 0) + 1 + (options.tagline ? 1 : 0);
    return 36 + lines * 40;
  }

  private captionSvg(options: FrameOptions, width: number, height: number, ink: string, opacity = 1): string {
    let y = 62;
    const rows: string[] = [];
    if (options.participantName) {
      rows.push(
        `<text x="32" y="${y}" font-family="Arial, sans-serif" font-size="38" font-weight="800" fill="${ink}">${escapeXml(options.participantName)}</text>`,
      );
      y += 40;
    }
    rows.push(
      `<text x="32" y="${y}" font-family="Arial, sans-serif" font-size="24" fill="${options.accentColor}">${escapeXml(options.eventName)}</text>`,
    );
    y += 34;
    if (options.tagline) {
      rows.push(
        `<text x="32" y="${y}" font-family="Arial, sans-serif" font-size="19" fill="${ink}" fill-opacity="0.75">${escapeXml(options.tagline)}</text>`,
      );
    }
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="${options.color}" fill-opacity="${opacity}"/>${rows.join('')}</svg>`;
  }

  // Logo fitted in a `box` px square, its right edge at `right`, top at `top`.
  private async logoLayer(
    logo: Buffer,
    box: number,
    right: number,
    top: number,
  ): Promise<sharp.OverlayOptions> {
    const input = await sharp(logo)
      .resize(box, box, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const { width = box } = await sharp(input).metadata();
    return { input, left: Math.max(0, right - width), top };
  }
}
