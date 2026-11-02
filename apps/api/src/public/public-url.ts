import { ConfigService } from '@nestjs/config';

// Link shared with the participant (email, WhatsApp, QR): the public download page.
export function publicPortraitUrl(config: ConfigService, publicCode: string): string {
  const base = (config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:3100').replace(/\/+$/, '');
  return `${base}/p/${publicCode}`;
}
