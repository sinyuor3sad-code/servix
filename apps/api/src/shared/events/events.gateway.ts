import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
interface Socket {
  id: string;
  handshake: { query: Record<string, string | string[] | undefined> };
  join(room: string): void;
}

interface Server {
  to(room: string): { emit(event: string, data: unknown): void };
  emit(event: string, data: unknown): void;
}
import { Logger } from '@nestjs/common';

const nodeEnv = process.env.NODE_ENV || 'development';
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin:
      nodeEnv === 'production'
        ? corsOrigins.length > 0
          ? corsOrigins
          : false
        : '*',
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket): void {
    const tenantId = client.handshake.query.tenantId as string;
    const userId = client.handshake.query.userId as string;
    const orderRoom = client.handshake.query.orderRoom as string;
    if (tenantId) client.join(`tenant:${tenantId}`);
    if (userId) client.join(`user:${userId}`);
    if (orderRoom) client.join(`order:${orderRoom}`);
    this.logger.log(`Client connected: ${client.id}${orderRoom ? ` (order: ${orderRoom})` : ''}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitToTenant(tenantId: string, event: string, data: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToOrder(tenantSlug: string, orderCode: string, event: string, data: unknown): void {
    this.server.to(`order:${tenantSlug}:${orderCode}`).emit(event, data);
  }

  emitToAll(event: string, data: unknown): void {
    this.server.emit(event, data);
  }
}
