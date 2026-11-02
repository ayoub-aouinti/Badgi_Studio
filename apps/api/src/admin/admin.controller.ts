import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminAuth, AdminGuard } from './admin.guard';
import { AdminEventsService } from './admin-events.service';
import { AdminStatsService } from './admin-stats.service';
import { CreateEventDto, LoginDto, UpdateEventDto } from './dto/admin.dto';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly auth: AdminAuth) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return { token: this.auth.login(dto.password) };
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/events')
export class AdminEventsController {
  constructor(
    private readonly events: AdminEventsService,
    private readonly stats: AdminStatsService,
  ) {}

  @Get()
  list() {
    return this.events.list();
  }

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.events.create(dto);
  }

  @Get(':eventId')
  get(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.events.get(eventId);
  }

  @Patch(':eventId')
  update(@Param('eventId', ParseUUIDPipe) eventId: string, @Body() dto: UpdateEventDto) {
    return this.events.update(eventId, dto);
  }

  @Post(':eventId/wall-token')
  regenerateWallToken(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.events.regenerateWallToken(eventId);
  }

  @Get(':eventId/stats')
  getStats(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.stats.get(eventId);
  }
}
