import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Single organiser account: ADMIN_PASSWORD from .env. Login returns an HMAC token so the
// password itself is not kept in the browser.
@Injectable()
export class AdminAuth {
  constructor(private readonly config: ConfigService) {}

  private password(): string {
    return this.config.get<string>('ADMIN_PASSWORD') ?? 'admin';
  }

  private token(): string {
    const secret = this.config.get<string>('DEVICE_TOKEN_SECRET') ?? 'dev-secret';
    return createHmac('sha256', secret).update(`admin:${this.password()}`).digest('hex');
  }

  login(password: string): string {
    if (!safeEqual(password, this.password())) throw new UnauthorizedException('Wrong password');
    return this.token();
  }

  verify(token: string): boolean {
    return safeEqual(token, this.token());
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AdminAuth) {}

  canActivate(context: ExecutionContext): boolean {
    const header: string | undefined = context.switchToHttp().getRequest().headers['authorization'];
    if (!header?.startsWith('Bearer ') || !this.auth.verify(header.slice(7).trim())) {
      throw new UnauthorizedException('Admin login required');
    }
    return true;
  }
}
