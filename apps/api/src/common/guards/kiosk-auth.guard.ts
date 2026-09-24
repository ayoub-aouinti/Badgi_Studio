import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KioskAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing kiosk device token');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const kiosk = await this.prisma.kiosk.findFirst({
      where: { deviceTokenHash: tokenHash },
    });
    if (!kiosk) {
      throw new UnauthorizedException('Invalid kiosk device token');
    }

    await this.prisma.kiosk.update({
      where: { id: kiosk.id },
      data: { lastSeenAt: new Date() },
    });

    request.kiosk = kiosk;
    return true;
  }
}
