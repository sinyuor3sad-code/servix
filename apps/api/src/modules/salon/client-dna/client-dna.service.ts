import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import type { Client, ClientDna } from '../../../../generated/tenant';
import { TenantPrismaClient } from '@shared/types';

export type ClientDnaProfile = {
  client: Client;
  dna: ClientDna | null;
};

@Injectable()
export class ClientDnaService {
  private readonly logger = new Logger(ClientDnaService.name);

  /**
   * Compute all DNA metrics for a single client based on their appointment history.
   */
  async computeForClient(db: TenantPrismaClient, clientId: string): Promise<void> {
    const client = await db.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('العميل غير موجود');
    }

    // Get all completed appointments for this client
    const appointments = await db.appointment.findMany({
      where: {
        clientId,
        status: 'completed',
      },
      orderBy: { date: 'asc' },
      include: {
        appointmentServices: {
          include: { service: true, employee: true },
        },
        invoices: {
          include: { payments: true },
        },
      },
    });

    const totalVisits = appointments.length;
    if (totalVisits === 0) {
      // No visit data — upsert minimal DNA
      await db.clientDna.upsert({
        where: { clientId },
        update: {
          churnRisk: 'low',
          vipScore: 0,
          isVip: false,
          lastComputedAt: new Date(),
        },
        create: {
          clientId,
          churnRisk: 'low',
          vipScore: 0,
          isVip: false,
          lastComputedAt: new Date(),
        },
      });
      return;
    }

    // --- Compute metrics ---

    // Ticket values
    const ticketValues = appointments.map((a) => Number(a.totalPrice));
    const avgTicketValue = ticketValues.reduce((s, v) => s + v, 0) / totalVisits;
    const maxTicketValue = Math.max(...ticketValues);

    // Visit frequency
    const visitDates = appointments.map((a) => new Date(a.date).getTime());
    let totalGapDays = 0;
    for (let i = 1; i < visitDates.length; i++) {
      totalGapDays += (visitDates[i] - visitDates[i - 1]) / (1000 * 60 * 60 * 24);
    }
    const avgDaysBetweenVisits = totalVisits > 1
      ? totalGapDays / (totalVisits - 1)
      : 30; // Default assumption

    const daysSinceLastVisit = Math.floor(
      (Date.now() - visitDates[visitDates.length - 1]) / (1000 * 60 * 60 * 24),
    );

    // Expected next visit
    const expectedNextVisitAt = new Date(
      visitDates[visitDates.length - 1] + avgDaysBetweenVisits * 24 * 60 * 60 * 1000,
    );

    // Churn risk
    const churnRatio = avgDaysBetweenVisits > 0
      ? daysSinceLastVisit / avgDaysBetweenVisits
      : 0;
    const churnProbability = Math.min(1, Math.max(0, (churnRatio - 1) * 0.5));
    const churnRisk = churnRatio > 3 ? 'critical'
      : churnRatio > 2 ? 'high'
      : churnRatio > 1.3 ? 'medium'
      : 'low';

    // Price sensitivity
    const ticketVariance = ticketValues.length > 1
      ? ticketValues.reduce((s, v) => s + Math.pow(v - avgTicketValue, 2), 0) / ticketValues.length
      : 0;
    const ticketStdDev = Math.sqrt(ticketVariance);
    const priceSensitivity = ticketStdDev > avgTicketValue * 0.3 ? 'high'
      : ticketStdDev > avgTicketValue * 0.15 ? 'moderate'
      : 'low';

    // VIP scoring (0-100)
    const frequencyScore = Math.min(30, (365 / avgDaysBetweenVisits) * 2);     // Max 30 pts
    const spendScore = Math.min(40, (Number(client.totalSpent) / 1000) * 10);   // Max 40 pts
    const loyaltyScore = Math.min(30, totalVisits * 1.5);                        // Max 30 pts
    const vipScore = Math.round(frequencyScore + spendScore + loyaltyScore);
    const isVip = vipScore >= 70;

    // Top services
    const serviceCounts: Record<string, number> = {};
    const employeeCounts: Record<string, number> = {};
    for (const appt of appointments) {
      for (const as of appt.appointmentServices) {
        serviceCounts[as.serviceId] = (serviceCounts[as.serviceId] || 0) + 1;
        employeeCounts[as.employeeId] = (employeeCounts[as.employeeId] || 0) + 1;
      }
    }

    const topServiceIds = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const topEmployeeIds = Object.entries(employeeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    // Preferred payment method
    const paymentCounts: Record<string, number> = {};
    for (const appt of appointments) {
      for (const inv of appt.invoices) {
        for (const pay of inv.payments) {
          paymentCounts[pay.method] = (paymentCounts[pay.method] || 0) + 1;
        }
      }
    }
    const preferredPayMethod = Object.entries(paymentCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] as 'cash' | 'card' | 'wallet' | 'bank_transfer' | 'stc_pay' | 'apple_pay' | undefined;

    // Predicted CLV (12-month forward)
    const visitsPerYear = 365 / avgDaysBetweenVisits;
    const predictedClv = avgTicketValue * visitsPerYear;

    // Upsert DNA record
    await db.clientDna.upsert({
      where: { clientId },
      update: {
        predictedClv,
        churnRisk,
        churnProbability,
        priceSensitivity,
        avgDaysBetweenVisits,
        daysSinceLastVisit,
        expectedNextVisitAt,
        avgTicketValue,
        maxTicketValue,
        preferredPayMethod,
        topServiceIds,
        topEmployeeIds,
        vipScore,
        isVip,
        lastComputedAt: new Date(),
      },
      create: {
        clientId,
        predictedClv,
        churnRisk,
        churnProbability,
        priceSensitivity,
        avgDaysBetweenVisits,
        daysSinceLastVisit,
        expectedNextVisitAt,
        avgTicketValue,
        maxTicketValue,
        preferredPayMethod,
        topServiceIds,
        topEmployeeIds,
        vipScore,
        isVip,
        lastComputedAt: new Date(),
      },
    });

    this.logger.debug(`Computed DNA for client ${clientId}: VIP=${vipScore}, churn=${churnRisk}`);
  }

  /**
   * Batch compute DNA for all active clients. Designed for nightly BullMQ job.
   */
  async computeAll(db: TenantPrismaClient): Promise<{ processed: number }> {
    const clients = await db.client.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });

    let processed = 0;
    for (const client of clients) {
      try {
        await this.computeForClient(db, client.id);
        processed++;
      } catch (error) {
        this.logger.error(`Failed to compute DNA for client ${client.id}: ${error}`);
      }
    }

    this.logger.log(`Client DNA batch complete: ${processed}/${clients.length} processed`);
    return { processed };
  }

  async getProfile(db: TenantPrismaClient, clientId: string): Promise<ClientDnaProfile> {
    const row = await db.client.findFirst({
      where: { id: clientId, deletedAt: null },
      include: { dna: true },
    });
    if (!row) {
      throw new NotFoundException('العميل غير موجود');
    }
    const { dna, ...client } = row;
    return { client: client as Client, dna };
  }

  /**
   * Calculate churn probability for a specific client.
   * Formula: if daysSinceLastVisit > 2× avgDaysBetweenVisits → high risk.
   */
  async detectChurnRisk(db: TenantPrismaClient, clientId: string): Promise<number> {
    const dna = await db.clientDna.findUnique({ where: { clientId } });
    if (!dna || !dna.avgDaysBetweenVisits || !dna.daysSinceLastVisit) {
      return 0;
    }

    const ratio = dna.daysSinceLastVisit / Number(dna.avgDaysBetweenVisits);
    return Math.min(1, Math.max(0, (ratio - 1) * 0.5));
  }

  /**
   * CLV = avgTicket × (365 / avgDaysBetweenVisits)
   */
  async calculatePredictedClv(db: TenantPrismaClient, clientId: string): Promise<number> {
    const dna = await db.clientDna.findUnique({ where: { clientId } });
    if (!dna || !dna.avgTicketValue || !dna.avgDaysBetweenVisits) {
      return 0;
    }

    const visitsPerYear = 365 / Number(dna.avgDaysBetweenVisits);
    return Number(dna.avgTicketValue) * visitsPerYear;
  }
}
