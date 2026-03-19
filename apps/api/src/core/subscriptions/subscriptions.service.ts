import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import type {
  Plan,
  Subscription,
  Feature,
  PlanFeature,
} from '../../shared/database';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

export type PlanWithFeatures = Plan & {
  planFeatures: (PlanFeature & { feature: Feature })[];
};

export type SubscriptionWithPlan = Subscription & {
  plan: Plan;
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PlatformPrismaClient) {}

  async getPlans(): Promise<PlanWithFeatures[]> {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      include: {
        planFeatures: {
          include: { feature: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getPlanById(id: string): Promise<PlanWithFeatures> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        planFeatures: {
          include: { feature: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('الباقة غير موجودة');
    }

    return plan;
  }

  async createSubscription(dto: CreateSubscriptionDto): Promise<SubscriptionWithPlan> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('الباقة غير موجودة');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          tenantId: dto.tenantId,
          status: { in: ['active', 'trial'] },
        },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });

      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date();

      if (dto.billingCycle === 'monthly') {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      } else {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      }

      const subscription = await tx.subscription.create({
        data: {
          tenantId: dto.tenantId,
          planId: dto.planId,
          billingCycle: dto.billingCycle,
          status: 'active',
          currentPeriodStart,
          currentPeriodEnd,
        },
        include: { plan: true },
      });

      await tx.tenant.update({
        where: { id: dto.tenantId },
        data: { status: 'active' },
      });

      return subscription;
    });
  }

  async getCurrentSubscription(tenantId: string): Promise<SubscriptionWithPlan> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['active', 'trial', 'expired'] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('لا يوجد اشتراك حالي');
    }

    return subscription;
  }

  async cancelSubscription(tenantId: string): Promise<SubscriptionWithPlan> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['active', 'trial'] },
      },
    });

    if (!subscription) {
      throw new NotFoundException('لا يوجد اشتراك نشط للإلغاء');
    }

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
      include: { plan: true },
    });
  }

  async renewSubscription(tenantId: string): Promise<SubscriptionWithPlan> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['active', 'expired', 'cancelled'] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('لا يوجد اشتراك للتجديد');
    }

    if (subscription.status === 'active') {
      throw new BadRequestException('الاشتراك نشط بالفعل ولا يحتاج تجديد');
    }

    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();

    if (subscription.billingCycle === 'monthly') {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    } else {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    }

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'active',
        currentPeriodStart,
        currentPeriodEnd,
        cancelledAt: null,
      },
      include: { plan: true },
    });
  }
}
