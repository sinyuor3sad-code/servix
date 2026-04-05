import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { CreatePackageDto } from './dto/create-package.dto';

@Injectable()
export class PackagesService {
  async findAll(db: TenantPrismaClient) {
    const packages = await db.package.findMany({
      where: { isActive: true },
      include: {
        services: {
          include: { service: { select: { id: true, nameAr: true, nameEn: true, price: true, duration: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return packages.map((p: any) => ({
      ...p,
      originalPrice: Number(p.originalPrice),
      packagePrice: Number(p.packagePrice),
      services: p.services.map((ps: any) => ({
        ...ps.service,
        price: Number(ps.service.price),
      })),
    }));
  }

  async create(db: TenantPrismaClient, dto: CreatePackageDto) {
    const services = await db.service.findMany({
      where: { id: { in: dto.serviceIds } },
    });
    const originalPrice = services.reduce((sum: number, s: any) => sum + Number(s.price), 0);

    const pkg = await db.package.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        originalPrice,
        packagePrice: dto.packagePrice,
        services: {
          create: dto.serviceIds.map((sid) => ({ serviceId: sid })),
        },
      },
      include: { services: { include: { service: true } } },
    });

    return {
      ...pkg,
      originalPrice: Number(pkg.originalPrice),
      packagePrice: Number(pkg.packagePrice),
    };
  }

  async remove(db: TenantPrismaClient, id: string) {
    const pkg = await db.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('الباقة غير موجودة');
    await db.package.update({ where: { id }, data: { isActive: false } });
    return { message: 'تم حذف الباقة' };
  }
}
