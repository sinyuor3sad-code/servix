import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import type { Feature } from '../../shared/database';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';

export interface TenantFeatureResult {
  feature: Feature;
  source: 'plan' | 'tenant_override';
  isEnabled: boolean;
}

export interface FeatureCheckResult {
  featureCode: string;
  isEnabled: boolean;
}

@Injectable()
export class FeaturesService {
  constructor(private readonly prisma: PlatformPrismaClient) {}

  async findAll(): Promise<Feature[]> {
    return this.prisma.feature.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Feature> {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new NotFoundException('الميزة غير موجودة');
    }

    return feature;
  }

  async create(dto: CreateFeatureDto): Promise<Feature> {
    const existing = await this.prisma.feature.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('رمز الميزة مستخدم بالفعل');
    }

    return this.prisma.feature.create({
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        descriptionAr: dto.descriptionAr,
      },
    });
  }

  async update(id: string, dto: UpdateFeatureDto): Promise<Feature> {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new NotFoundException('الميزة غير موجودة');
    }

    if (dto.code && dto.code !== feature.code) {
      const existingCode = await this.prisma.feature.findUnique({
        where: { code: dto.code },
      });
      if (existingCode) {
        throw new ConflictException('رمز الميزة مستخدم بالفعل');
      }
    }

    return this.prisma.feature.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.descriptionAr !== undefined && { descriptionAr: dto.descriptionAr }),
      },
    });
  }

  async getTenantFeatures(tenantId: string): Promise<TenantFeatureResult[]> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('المنشأة غير موجودة');
    }

    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['active', 'trial'] },
      },
      include: {
        plan: {
          include: {
            planFeatures: {
              include: { feature: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const tenantOverrides = await this.prisma.tenantFeature.findMany({
      where: { tenantId },
      include: { feature: true },
    });

    const overrideMap = new Map(
      tenantOverrides.map((tf) => [tf.featureId, tf]),
    );

    const results: TenantFeatureResult[] = [];
    const processedFeatureIds = new Set<string>();

    if (activeSubscription?.plan?.planFeatures) {
      for (const pf of activeSubscription.plan.planFeatures) {
        const override = overrideMap.get(pf.featureId);
        processedFeatureIds.add(pf.featureId);

        if (override) {
          results.push({
            feature: pf.feature,
            source: 'tenant_override',
            isEnabled: override.isEnabled,
          });
        } else {
          results.push({
            feature: pf.feature,
            source: 'plan',
            isEnabled: true,
          });
        }
      }
    }

    for (const override of tenantOverrides) {
      if (!processedFeatureIds.has(override.featureId)) {
        results.push({
          feature: override.feature,
          source: 'tenant_override',
          isEnabled: override.isEnabled,
        });
      }
    }

    return results;
  }

  async isFeatureEnabled(
    tenantId: string,
    featureCode: string,
  ): Promise<FeatureCheckResult> {
    const feature = await this.prisma.feature.findUnique({
      where: { code: featureCode },
    });

    if (!feature) {
      return { featureCode, isEnabled: false };
    }

    const tenantOverride = await this.prisma.tenantFeature.findUnique({
      where: {
        tenantId_featureId: { tenantId, featureId: feature.id },
      },
    });

    if (tenantOverride) {
      return { featureCode, isEnabled: tenantOverride.isEnabled };
    }

    const planFeature = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['active', 'trial'] },
        plan: {
          planFeatures: {
            some: { featureId: feature.id },
          },
        },
      },
    });

    return { featureCode, isEnabled: !!planFeature };
  }
}
