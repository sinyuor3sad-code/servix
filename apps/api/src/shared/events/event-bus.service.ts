import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TenantPrismaClient } from '../types';

export interface DomainEventPayload {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  emittedBy?: string;
  tenantDatabaseName?: string;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @InjectQueue('ops.intelligence')
    private readonly opsQueue: Queue,
  ) {}

  /**
   * Save a domain event to the database and dispatch it to the BullMQ queue
   * for asynchronous processing (healing, inventory alerts, etc.)
   */
  async emit(
    db: TenantPrismaClient,
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    emittedBy?: string,
    tenantDatabaseName?: string,
  ): Promise<void> {
    // Persist the event
    const event = await db.domainEvent.create({
      data: {
        eventType,
        aggregateType,
        aggregateId,
        payload: payload as unknown as import('../../../generated/tenant').Prisma.InputJsonValue,
        emittedBy: emittedBy ?? 'EventBusService',
      },
    });

    // Dispatch to BullMQ for async processing
    await this.opsQueue.add(eventType, {
      eventId: event.id,
      eventType,
      aggregateType,
      aggregateId,
      payload,
      tenantDatabaseName,
    } satisfies DomainEventPayload & { eventId: string });

    this.logger.log(
      `Emitted ${eventType} for ${aggregateType}:${aggregateId} → ops.intelligence queue`,
    );
  }
}
