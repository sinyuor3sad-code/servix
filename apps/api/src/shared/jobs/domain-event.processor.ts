import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import type { DomainEventPayload } from '../events/event-bus.service';
import { TenantClientFactory } from '../database/tenant-client.factory';
import { HealingService } from '../../modules/salon/healing/healing.service';
import { InventoryService } from '../../modules/salon/inventory/inventory.service';

@Processor('ops.intelligence')
export class DomainEventProcessor extends WorkerHost {
  private readonly logger = new Logger(DomainEventProcessor.name);

  constructor(
    private readonly tenantClientFactory: TenantClientFactory,
    private readonly healingService: HealingService,
    private readonly inventoryService: InventoryService,
  ) {
    super();
  }

  async process(job: Job<DomainEventPayload & { eventId: string }>): Promise<void> {
    const { eventType, aggregateId, payload, tenantDatabaseName } = job.data;

    if (!tenantDatabaseName) {
      this.logger.warn(`No tenantDatabaseName in event ${eventType}, skipping.`);
      return;
    }

    const db = this.tenantClientFactory.getTenantClient(tenantDatabaseName);

    try {
      switch (eventType) {
        case 'STAFF_DELAYED': {
          // Find the commitment for this shift and trigger healing
          const shiftCommitment = await db.commitment.findFirst({
            where: {
              type: 'shift',
              referenceId: aggregateId,
              state: { in: ['pledged', 'confirmed', 'in_progress'] },
            },
          });

          if (shiftCommitment) {
            // Break the commitment
            await db.commitment.update({
              where: { id: shiftCommitment.id },
              data: { state: 'broken', brokenAt: new Date() },
            });

            const results = await this.healingService.evaluateAndHeal(db, shiftCommitment.id);
            this.logger.log(
              `Healing cascade for STAFF_DELAYED: ${results.length} appointments processed`,
            );
          }
          break;
        }

        case 'APPOINTMENT_COMPLETED': {
          const appointmentId = payload.appointmentId as string || aggregateId;
          await this.inventoryService.autoDeductForAppointment(db, appointmentId);
          this.logger.log(`Inventory auto-deducted for appointment ${appointmentId}`);
          break;
        }

        default:
          this.logger.debug(`Unhandled event type: ${eventType}`);
      }

      // Mark event as processed
      await db.domainEvent.updateMany({
        where: { id: job.data.eventId },
        data: { processedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`Failed to process ${eventType}: ${error}`);

      // Mark event as failed
      await db.domainEvent.updateMany({
        where: { id: job.data.eventId },
        data: {
          failedAt: new Date(),
          retryCount: { increment: 1 },
        },
      });

      throw error; // Let BullMQ handle retries
    }
  }
}
