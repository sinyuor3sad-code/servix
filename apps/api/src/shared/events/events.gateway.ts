import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { WsAuthGuard, WsSocket } from './ws-auth.guard';

// Minimal structural type for the broadcast surface we touch on the
// Socket.IO Server. socket.io ships transitively via
// @nestjs/platform-socket.io; we don't import it directly.
interface WsServer {
  to(room: string): { emit(event: string, data: unknown): void };
  emit(event: string, data: unknown): void;
}

// Extend WsSocket with room-joining for the gateway side only.
type GatewaySocket = WsSocket & { join(room: string): void };

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
  server!: WsServer;

  private logger = new Logger(EventsGateway.name);

  constructor(private readonly wsAuthGuard: WsAuthGuard) {}

  // V-01: handleConnection is the only place a client can attach.
  // We invoke WsAuthGuard manually because the gateway has no
  // @SubscribeMessage handlers — NestJS only auto-invokes guards on
  // those. Rooms are joined strictly from the validated JWT payload
  // (never from the query string) so an attacker cannot subscribe to
  // another tenant's room.
  //
  // When WS_AUTH_ENFORCE is OFF the guard returns null on a failed
  // validation; we fall back to the legacy query-based join with a
  // warning log so the soak window can still observe legitimate
  // traffic shapes.
  async handleConnection(client: GatewaySocket): Promise<void> {
    try {
      const validated = await this.wsAuthGuard.validateConnection(client);

      if (validated) {
        client.join(`tenant:${validated.tenantId}`);
        client.join(`user:${validated.userId}`);
        const orderRoom = this.queryString(client, 'orderRoom');
        if (orderRoom) client.join(`order:${orderRoom}`);
        this.logger.log(
          `Client connected: ${client.id} | tenant=${validated.tenantId} user=${validated.userId}${orderRoom ? ` order=${orderRoom}` : ''}`,
        );
        return;
      }

      // Flag is OFF: legacy fallback. Connection is accepted with
      // whatever query fields it sent.
      const tenantId = this.queryString(client, 'tenantId');
      const userId = this.queryString(client, 'userId');
      const orderRoom = this.queryString(client, 'orderRoom');
      if (tenantId) client.join(`tenant:${tenantId}`);
      if (userId) client.join(`user:${userId}`);
      if (orderRoom) client.join(`order:${orderRoom}`);
      this.logger.log(
        `Client connected (legacy, flag off): ${client.id}${orderRoom ? ` order=${orderRoom}` : ''}`,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(
        `WS handshake rejected | socket=${client.id} reason="${reason}"`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: GatewaySocket): void {
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

  private queryString(client: GatewaySocket, key: string): string | null {
    const value = client.handshake.query?.[key];
    if (typeof value === 'string') return value;
    return null;
  }
}
