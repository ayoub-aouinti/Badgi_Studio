import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { DeliveryProcessor } from './delivery.processor';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.interface';
import { MailSender } from '../mail/mail.interface';
import { SendEmailJobData } from './deliveries.service';

function delivery(overrides: { status?: string; portrait?: Record<string, unknown> } = {}) {
  return {
    id: 'delivery-1',
    recipient: 'amira@example.com',
    status: overrides.status ?? 'PENDING',
    portrait: {
      publicCode: 'ABCDE12345',
      framedKey: 'portraits/s1/framed.jpg',
      purgedAt: null,
      session: {
        participant: { firstName: 'Amira' },
        kiosk: { event: { name: 'Congrès démo', studioConfig: { primaryColor: '#0B6E69' } } },
      },
      ...overrides.portrait,
    },
  };
}

const job = (attemptsMade = 0) =>
  ({ data: { deliveryId: 'delivery-1' }, attemptsMade, opts: { attempts: 2 } }) as unknown as Job<SendEmailJobData>;

describe('DeliveryProcessor', () => {
  let processor: DeliveryProcessor;
  let prisma: { delivery: { findUniqueOrThrow: jest.Mock; update: jest.Mock } };
  let storage: StorageService;
  let mail: { send: jest.Mock };

  beforeEach(() => {
    prisma = { delivery: { findUniqueOrThrow: jest.fn(), update: jest.fn().mockResolvedValue({}) } };
    storage = {
      put: jest.fn(),
      get: jest.fn().mockResolvedValue(Buffer.from('jpeg')),
      getUrl: jest.fn(),
      delete: jest.fn(),
    };
    mail = { send: jest.fn().mockResolvedValue({ messageId: '<msg-1@test>' }) };
    const config = new ConfigService({ PUBLIC_BASE_URL: 'https://studio.example.com/' });
    processor = new DeliveryProcessor(
      prisma as unknown as PrismaService,
      config,
      storage,
      mail as MailSender,
    );
  });

  it('emails the framed portrait with the public page link and marks the delivery sent', async () => {
    prisma.delivery.findUniqueOrThrow.mockResolvedValue(delivery());

    await processor.process(job());

    const message = mail.send.mock.calls[0][0];
    expect(message.to).toBe('amira@example.com');
    expect(message.subject).toContain('Congrès démo');
    expect(message.text).toContain('https://studio.example.com/p/ABCDE12345');
    expect(message.html).toContain('cid:');
    expect(message.attachments[0].content).toEqual(Buffer.from('jpeg'));
    expect(prisma.delivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: 'SENT', providerMessageId: '<msg-1@test>' }),
    });
  });

  it('escapes participant input in the HTML body', async () => {
    prisma.delivery.findUniqueOrThrow.mockResolvedValue(
      delivery({
        portrait: {
          session: {
            participant: { firstName: '<script>x</script>' },
            kiosk: { event: { name: 'Congrès', studioConfig: null } },
          },
        },
      }),
    );

    await processor.process(job());

    expect(mail.send.mock.calls[0][0].html).not.toContain('<script>');
  });

  it('does not send twice when the delivery is already sent', async () => {
    prisma.delivery.findUniqueOrThrow.mockResolvedValue(delivery({ status: 'SENT' }));

    await processor.process(job());

    expect(mail.send).not.toHaveBeenCalled();
  });

  it('marks the delivery failed without sending when the portrait was purged', async () => {
    prisma.delivery.findUniqueOrThrow.mockResolvedValue(
      delivery({ portrait: { purgedAt: new Date(), framedKey: null } }),
    );

    await processor.process(job());

    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.delivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });

  it('marks the delivery failed only once all attempts are used', async () => {
    await processor.onFailed(job(1), new Error('SMTP timeout'));
    expect(prisma.delivery.update).not.toHaveBeenCalled();

    await processor.onFailed(job(2), new Error('SMTP timeout'));
    expect(prisma.delivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { status: 'FAILED', error: 'SMTP timeout' },
    });
  });
});
