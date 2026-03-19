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

@WebSocketGateway({
  cors: { origin: '*' },
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
    if (tenantId) client.join(`tenant:${tenantId}`);
    if (userId) client.join(`user:${userId}`);
    this.logger.log(`Client connected: ${client.id}`);
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

  emitToAll(event: string, data: unknown): void {
    this.server.emit(event, data);
  }
}
