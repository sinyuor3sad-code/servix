import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import type {
  Tenant,
  Subscription,
  TenantFeature,
  Feature,
  Plan,
} from '../../shared/database';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ToggleFeaturesDto } from './dto/toggle-features.dto';

const TRIAL_DAYS = 14;

export type TenantWithDetails = Tenant & {
  subscriptions: Subscription[];
  tenantFeatures: (TenantFeature & { feature: Feature })[];
};

export type SubscriptionWithPlan = Subscription & {
  plan: Plan;
};

export type TenantFeatureWithFeature = TenantFeature & {
  feature: Feature;
};

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PlatformPrismaClient) {}

  async create(dto: CreateTenantDto, ownerId: string): Promise<Tenant> {
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug) {
      throw new ConflictException('المعرف الفريد (slug) مستخدم بالفعل');
    }

    const uuidShort = randomUUID().replace(/-/g, '').substring(0, 12);
    const databaseName = `tenant_${uuidShort}`;

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          slug: dto.slug,
          phone: dto.phone,
          email: dto.email,
          city: dto.city,
          address: dto.address,
          primaryColor: dto.primaryColor,
          theme: dto.theme,
          databaseName,
          status: 'trial',
          trialEndsAt,
        },
      });

      const ownerRole = await tx.role.findFirst({
        where: { name: 'owner' },
      });

      if (ownerRole) {
        await tx.tenantUser.create({
          data: {
            tenantId: tenant.id,
            userId: ownerId,
            roleId: ownerRole.id,
            isOwner: true,
          },
        });
      }

      return tenant;
    });
  }

  async findOne(id: string): Promise<TenantWithDetails> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
        },
        tenantFeatures: {
          include: { feature: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    if (dto.slug && dto.slug !== tenant.slug) {
      const existingSlug = await this.prisma.tenant.findUnique({
        where: { slug: dto.slug },
      });
      if (existingSlug) {
        throw new ConflictException('المعرف الفريد (slug) مستخدم بالفعل');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.theme !== undefined && { theme: dto.theme }),
      },
    });
  }

  async suspend(id: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'suspended' },
    });
  }

  async getSubscription(tenantId: string): Promise<SubscriptionWithPlan> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['active', 'trial'] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('لا يوجد اشتراك حالي لهذه المنشأة');
    }

    return subscription;
  }

  async toggleFeatures(
    tenantId: string,
    dto: ToggleFeaturesDto,
  ): Promise<TenantFeatureWithFeature[]> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    const upsertPromises = dto.featureIds.map((featureId) =>
      this.prisma.tenantFeature.upsert({
        where: {
          tenantId_featureId: { tenantId, featureId },
        },
        create: {
          tenantId,
          featureId,
          isEnabled: dto.isEnabled,
          ...(dto.isEnabled ? {} : { disabledAt: new Date() }),
        },
        update: {
          isEnabled: dto.isEnabled,
          ...(dto.isEnabled
            ? { enabledAt: new Date(), disabledAt: null }
            : { disabledAt: new Date() }),
        },
        include: { feature: true },
      }),
    );

    return Promise.all(upsertPromises);
  }
}
