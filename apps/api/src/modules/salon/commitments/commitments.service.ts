import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Commitment,
  CommitmentDependency,
  CommitmentType,
  HealingAction,
} from '../../../../generated/tenant';
import { TenantPrismaClient } from '@shared/types';

@Injectable()
export class CommitmentsService {
  async create(
    db: TenantPrismaClient,
    type: CommitmentType,
    referenceId: string,
    ownerEmployeeId: string | null,
    clientId: string | null,
    startsAt: Date,
    endsAt: Date,
  ): Promise<Commitment> {
    return db.commitment.create({
      data: {
        type,
        referenceId,
        ownerEmployeeId: ownerEmployeeId ?? undefined,
        clientId: clientId ?? undefined,
        startsAt,
        endsAt,
      },
    });
  }

  async break(
    db: TenantPrismaClient,
    commitmentId: string,
    reason: string,
  ): Promise<Commitment> {
    const existing = await db.commitment.findUnique({ where: { id: commitmentId } });
    if (!existing) {
      throw new NotFoundException('Commitment not found');
    }

    const updated = await db.commitment.update({
      where: { id: commitmentId },
      data: {
        state: 'broken',
        brokenAt: new Date(),
      },
    });

    await db.domainEvent.create({
      data: {
        eventType: 'COMMITMENT_BROKEN',
        aggregateType: 'commitment',
        aggregateId: commitmentId,
        payload: { reason, previousState: existing.state },
      },
    });

    return updated;
  }

  async heal(
    db: TenantPrismaClient,
    commitmentId: string,
    action: HealingAction,
    note?: string,
  ): Promise<Commitment> {
    const existing = await db.commitment.findUnique({ where: { id: commitmentId } });
    if (!existing) {
      throw new NotFoundException('Commitment not found');
    }

    return db.commitment.update({
      where: { id: commitmentId },
      data: {
        state: 'healed',
        healedAt: new Date(),
        healingAction: action,
        healingNote: note,
      },
    });
  }

  async findDependents(db: TenantPrismaClient, commitmentId: string): Promise<Commitment[]> {
    const rows = await db.commitmentDependency.findMany({
      where: { dependsOnId: commitmentId },
      include: { commitment: true },
    });
    return rows.map((r) => r.commitment);
  }

  async linkDependency(
    db: TenantPrismaClient,
    commitmentId: string,
    dependsOnId: string,
    isCritical: boolean,
  ): Promise<CommitmentDependency> {
    return db.commitmentDependency.create({
      data: {
        commitmentId,
        dependsOnId,
        isCritical,
      },
    });
  }
}
