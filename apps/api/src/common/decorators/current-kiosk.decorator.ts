import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Kiosk } from '@prisma/client';

// Populated by KioskAuthGuard.
export const CurrentKiosk = createParamDecorator((_: unknown, ctx: ExecutionContext): Kiosk => {
  const request = ctx.switchToHttp().getRequest();
  return request.kiosk;
});
