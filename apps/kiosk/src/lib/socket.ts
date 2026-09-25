import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL, { autoConnect: true, transports: ['websocket'] });
  }
  return socket;
}

export function joinSessionRoom(sessionId: string) {
  getSocket().emit('session.join', sessionId);
}

export function onEvent<T>(event: string, handler: (payload: T) => void): () => void {
  const s = getSocket();
  s.on(event, handler as (...args: unknown[]) => void);
  return () => s.off(event, handler as (...args: unknown[]) => void);
}
