import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MAIL_SENDER } from './mail.interface';
import { SmtpMailSender } from './smtp-mail.sender';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAIL_SENDER,
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('MAIL_DRIVER') ?? 'smtp';
        if (driver !== 'smtp') throw new Error(`Unsupported MAIL_DRIVER "${driver}" (expected: smtp)`);
        return new SmtpMailSender(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [MAIL_SENDER],
})
export class MailModule {}
