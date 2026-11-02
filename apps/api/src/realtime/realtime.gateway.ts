import { Injectable } from '@nestjs/common';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  WS_EVENTS,
  PortraitProgressEvent,
  PortraitReadyEvent,
  PortraitRejectedEvent,
  WallNewEvent,
  WallRemoveEvent,
} from '@badgi-studio/shared';
import { PrismaService } from '../prisma/prisma.service';

function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

// One room per event: each congress wall only receives its own portraits.
function wallRoom(eventId: string): string {
  return `wall:${eventId}`;
}

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly prisma: PrismaService) {}

  handleConnection(client: Socket) {
    void client;
  }

  @SubscribeMessage('session.join')
  onJoinSession(client: Socket, sessionId: string) {
    client.join(sessionRoom(sessionId));
  }

  // The wall token (secret in the wall URL) picks the event; an unknown token joins nothing.
  @SubscribeMessage('wall.join')
  async onJoinWall(client: Socket, token: unknown) {
    if (typeof token !== 'string' || !token) return { joined: false };
    const config = await this.prisma.studioConfig.findUnique({ where: { wallToken: token }, select: { eventId: true } });
    if (!config) return { joined: false };
    client.join(wallRoom(config.eventId));
    return { joined: true };
  }

  emitPortraitProgress(event: PortraitProgressEvent) {
    this.server.to(sessionRoom(event.sessionId)).emit(WS_EVENTS.PORTRAIT_PROGRESS, event);
  }

  emitPortraitReady(event: PortraitReadyEvent) {
    this.server.to(sessionRoom(event.sessionId)).emit(WS_EVENTS.PORTRAIT_READY, event);
  }

  emitPortraitRejected(event: PortraitRejectedEvent) {
    this.server.to(sessionRoom(event.sessionId)).emit(WS_EVENTS.PORTRAIT_REJECTED, event);
  }

  emitWallNew(eventId: string, event: WallNewEvent) {
    this.server.to(wallRoom(eventId)).emit(WS_EVENTS.WALL_NEW, event);
  }

  emitWallRemove(eventId: string, event: WallRemoveEvent) {
    this.server.to(wallRoom(eventId)).emit(WS_EVENTS.WALL_REMOVE, event);
  }
}
