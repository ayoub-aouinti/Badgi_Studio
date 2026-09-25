import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL, { autoConnect: true, transports: ['websocket'] });
    socket.on('connect', () => socket?.emit('wall.join'));
  }
  return socket;
}

export function onEvent<T>(event: string, handler: (payload: T) => void): () => void {
  const s = getSocket();
  s.on(event, handler as (...args: unknown[]) => void);
  return () => s.off(event, handler as (...args: unknown[]) => void);
}

// Ensure the socket connects (and (re)joins the wall room) as soon as the app mounts.
export function connectWall(): void {
  getSocket();
}
