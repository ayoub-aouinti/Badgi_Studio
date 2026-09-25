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
  WallNewEvent,
  WallRemoveEvent,
} from '@badgi-studio/shared';

const WALL_ROOM = 'wall';

function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    void client;
  }

  @SubscribeMessage('session.join')
  onJoinSession(client: Socket, sessionId: string) {
    client.join(sessionRoom(sessionId));
  }

  @SubscribeMessage('wall.join')
  onJoinWall(client: Socket) {
    client.join(WALL_ROOM);
  }

  emitPortraitProgress(event: PortraitProgressEvent) {
    this.server.to(sessionRoom(event.sessionId)).emit(WS_EVENTS.PORTRAIT_PROGRESS, event);
  }

  emitPortraitReady(event: PortraitReadyEvent) {
    this.server.to(sessionRoom(event.sessionId)).emit(WS_EVENTS.PORTRAIT_READY, event);
  }

  emitWallNew(event: WallNewEvent) {
    this.server.to(WALL_ROOM).emit(WS_EVENTS.WALL_NEW, event);
  }

  emitWallRemove(event: WallRemoveEvent) {
    this.server.to(WALL_ROOM).emit(WS_EVENTS.WALL_REMOVE, event);
  }
}
