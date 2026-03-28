import { Injectable } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto';

interface BrandingResponse {
  logoUrl: string | null;
  primaryColor: string;
  theme: string;
}

interface WorkingHoursResponse {
  workingDays: unknown;
  openingTime: string;
  closingTime: string;
  slotDuration: number;
  bufferTime: number;
}

@Injectable()
export class SalonInfoService {
  private async getOrCreateSalon(db: TenantPrismaClient) {
    const salon = await db.salonInfo.findFirst();
    if (salon) return salon;

    return db.salonInfo.create({
      data: {
        nameAr: 'صالوني',
        openingTime: '09:00',
        closingTime: '22:00',
        slotDuration: 30,
        bufferTime: 10,
      },
    });
  }

  async get(
    db: TenantPrismaClient,
  ): Promise<Record<string, unknown> & { branding: BrandingResponse }> {
    const salon = await this.getOrCreateSalon(db);

    const brandingKeys = [
      'salon_logo_url',
      'salon_primary_color',
      'salon_secondary_color',
      'salon_theme',
    ];
    const settings = await db.setting.findMany({
      where: { key: { in: brandingKeys } },
    });

    const branding: BrandingResponse = {
      logoUrl:
        settings.find((s) => s.key === 'salon_logo_url')?.value ?? null,
      primaryColor:
        settings.find((s) => s.key === 'salon_primary_color')?.value ??
        '#8B5CF6',
      theme:
        settings.find((s) => s.key === 'salon_theme')?.value ?? 'velvet',
    };

    return {
      ...salon,
      taxPercentage: Number(salon.taxPercentage),
      branding,
    };
  }

  async update(
    db: TenantPrismaClient,
    dto: UpdateSalonDto,
  ): Promise<Record<string, unknown>> {
    const salon = await this.getOrCreateSalon(db);

    const updated = await db.salonInfo.update({
      where: { id: salon.id },
      data: dto,
    });

    return {
      ...updated,
      taxPercentage: Number(updated.taxPercentage),
    };
  }

  async updateBranding(
    db: TenantPrismaClient,
    dto: UpdateBrandingDto,
  ): Promise<BrandingResponse> {
    const settingsMap: Record<string, string | undefined> = {
      salon_logo_url: dto.logoUrl,
      salon_primary_color: dto.primaryColor,
      salon_secondary_color: dto.secondaryColor,
      salon_theme: dto.theme,
    };

    for (const [key, value] of Object.entries(settingsMap)) {
      if (value !== undefined) {
        await db.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });
      }
    }

    const brandingKeys = [
      'salon_logo_url',
      'salon_primary_color',
      'salon_secondary_color',
      'salon_theme',
    ];
    const settings = await db.setting.findMany({
      where: { key: { in: brandingKeys } },
    });

    return {
      logoUrl:
        settings.find((s) => s.key === 'salon_logo_url')?.value ?? null,
      primaryColor:
        settings.find((s) => s.key === 'salon_primary_color')?.value ??
        '#8B5CF6',
      theme:
        settings.find((s) => s.key === 'salon_theme')?.value ?? 'velvet',
    };
  }

  async updateWorkingHours(
    db: TenantPrismaClient,
    dto: UpdateWorkingHoursDto,
  ): Promise<WorkingHoursResponse> {
    const salon = await this.getOrCreateSalon(db);

    const updated = await db.salonInfo.update({
      where: { id: salon.id },
      data: {
        ...(dto.workingDays !== undefined && { workingDays: dto.workingDays as unknown as undefined }),
        ...(dto.openingTime !== undefined && { openingTime: dto.openingTime }),
        ...(dto.closingTime !== undefined && {
          closingTime: dto.closingTime,
        }),
        ...(dto.slotDuration !== undefined && {
          slotDuration: dto.slotDuration,
        }),
        ...(dto.bufferTime !== undefined && { bufferTime: dto.bufferTime }),
      },
    });

    return {
      workingDays: updated.workingDays,
      openingTime: updated.openingTime,
      closingTime: updated.closingTime,
      slotDuration: updated.slotDuration,
      bufferTime: updated.bufferTime,
    };
  }
}
