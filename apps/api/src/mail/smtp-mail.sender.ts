import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { MailMessage, MailSender } from './mail.interface';

// MAIL_DRIVER=smtp: Mailpit in dev (docker-compose), any free SMTP relay later (Brevo, Gmail).
@Injectable()
export class SmtpMailSender implements MailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    this.from = config.get<string>('SMTP_FROM') ?? 'studio@example.com';
    this.transporter = createTransport({
      host: config.get<string>('SMTP_HOST') ?? 'localhost',
      port: parseInt(config.get<string>('SMTP_PORT') ?? '1025', 10),
      secure: config.get<string>('SMTP_SECURE') === 'true',
      auth: user ? { user, pass: config.get<string>('SMTP_PASSWORD') ?? '' } : undefined,
    });
  }

  async send(message: MailMessage): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({ from: this.from, ...message });
    return { messageId: info.messageId };
  }
}
