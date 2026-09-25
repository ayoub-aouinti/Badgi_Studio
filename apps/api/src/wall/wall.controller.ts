import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WallService } from './wall.service';

// Public: the token in the URL is the secret (docs/SPEC.md), no device auth needed —
// this is displayed on a TV in the venue, not a device we pair.
@ApiTags('wall')
@Controller('wall')
export class WallController {
  constructor(private readonly wallService: WallService) {}

  @Get(':token/feed')
  getFeed(@Param('token') token: string) {
    return this.wallService.getFeed(token);
  }
}
