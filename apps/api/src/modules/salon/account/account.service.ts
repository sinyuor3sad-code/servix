import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { compare } from 'bcryptjs';
import archiver from 'archiver';
import type { Response } from 'express';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantPrismaClient } from '../../../shared/types';
import { MailService } from '../../../shared/mail/mail.service';
import { SubscriptionsService } from '../../../core/subscriptions/subscriptions.service';
import type { AuthenticatedRequest } from '../../../shared/types';
import { DeleteAccountDto } from './dto/delete-account.dto';

const COOLING_DAYS = 7;

@Injectable()
export class AccountService {
  constructor(
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly mailService: MailService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async checkIsOwner(tenantId: string, userId: string): Promise<boolean> {
    const tu = await this.platformPrisma.tenantUser.findFirst({
      where: { tenantId, userId },
    });
    return tu?.isOwner ?? false;
  }

  async exportToZip(db: TenantPrismaClient, res: Response): Promise<void> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    const [clients, appointments, invoices, services, employees, settings, salonInfo] =
      await Promise.all([
        db.client.findMany(),
        db.appointment.findMany({ include: { appointmentServices: true } }),
        db.invoice.findMany({ include: { invoiceItems: true } }),
        db.service.findMany({ include: { category: true } }),
        db.employee.findMany(),
        db.setting.findMany(),
        db.salonInfo.findFirst(),
      ]);

    const toCsv = (rows: unknown[], headers: string[]): string => {
      const escape = (v: unknown) => (v === null || v === undefined ? '' : String(v).replace(/"/g, '""'));
      return [
        headers.join(','),
        ...rows.map((r) =>
          headers.map((h) => `"${escape((r as Record<string, unknown>)[h])}"`).join(','),
        ),
      ].join('\n');
    };

    const clientRows = clients.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      gender: c.gender,
      source: c.source,
      createdAt: c.createdAt,
    }));
    archive.append(toCsv(clientRows, ['id', 'fullName', 'phone', 'email', 'gender', 'source', 'createdAt']), {
      name: 'clients.csv',
    });

    const apptRows = appointments.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      employeeId: a.employeeId,
      status: a.status,
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      source: a.source,
      createdAt: a.createdAt,
    }));
    archive.append(toCsv(apptRows, ['id', 'clientId', 'employeeId', 'status', 'date', 'startTime', 'endTime', 'source', 'createdAt']), {
      name: 'appointments.csv',
    });

    const invRows = invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      clientId: i.clientId,
      status: i.status,
      total: i.total,
      createdAt: i.createdAt,
    }));
    archive.append(toCsv(invRows, ['id', 'invoiceNumber', 'clientId', 'status', 'total', 'createdAt']), {
      name: 'invoices.csv',
    });

    const svcRows = services.map((s) => ({
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      price: s.price,
      duration: s.duration,
      categoryId: s.categoryId,
    }));
    archive.append(toCsv(svcRows, ['id', 'nameAr', 'nameEn', 'price', 'duration', 'categoryId']), {
      name: 'services.csv',
    });

    const empRows = employees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      phone: e.phone,
      email: e.email,
      role: e.role,
    }));
    archive.append(toCsv(empRows, ['id', 'fullName', 'phone', 'email', 'role']), {
      name: 'employees.csv',
    });
    archive.append(
      JSON.stringify(
        { settings: settings.map((s) => ({ key: s.key, value: s.value })), salonInfo: salonInfo ?? null },
        null,
        2,
      ),
      { name: 'settings.json' },
    );

    await archive.finalize();
  }

  async requestDeletion(
    req: AuthenticatedRequest,
    dto: DeleteAccountDto,
  ): Promise<{ message: string; deletionAt: string }> {
    const tenantId = req.tenant?.id;
    const userId = req.user?.sub;
    if (!tenantId || !userId) {
      throw new ForbiddenException('غير مصرح');
    }

    const tu = await this.platformPrisma.tenantUser.findFirst({
      where: { tenantId, userId },
    });
    if (!tu?.isOwner) {
      throw new ForbiddenException('حذف الحساب متاح للمالك فقط');
    }

    const user = await this.platformPrisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new ForbiddenException('المستخدم غير موجود');

    const validPassword = await compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new BadRequestException('كلمة المرور غير صحيحة');
    }

    const tenant = await this.platformPrisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new ForbiddenException('الحساب غير موجود');

    if (
      tenant.nameAr !== dto.salonNameConfirm &&
      tenant.nameEn !== dto.salonNameConfirm
    ) {
      throw new BadRequestException('اسم الصالون غير مطابق للتأكيد');
    }

    try {
      await this.subscriptionsService.cancelSubscription(tenantId);
    } catch {
      // ignore if no active subscription
    }

    const deletionAt = new Date();
    deletionAt.setDate(deletionAt.getDate() + COOLING_DAYS);

    await this.platformPrisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'pending_deletion',
        pendingDeletionAt: deletionAt,
      },
    });

    await this.mailService.send({
      to: user.email,
      subject: 'SERVIX — طلب حذف الحساب',
      body: `تم طلب حذف حسابك. سيتم الحذف النهائي في ${deletionAt.toLocaleDateString('ar-SA')}. يمكنك إلغاء الطلب خلال 7 أيام من لوحة التحكم.`,
    });

    return {
      message: 'تم طلب الحذف. لديك 7 أيام للإلغاء',
      deletionAt: deletionAt.toISOString(),
    };
  }

  async cancelDeletion(req: AuthenticatedRequest): Promise<{ message: string }> {
    const tenantId = req.tenant?.id;
    const userId = req.user?.sub;
    if (!tenantId || !userId) {
      throw new ForbiddenException('غير مصرح');
    }

    const tu = await this.platformPrisma.tenantUser.findFirst({
      where: { tenantId, userId },
    });
    if (!tu?.isOwner) {
      throw new ForbiddenException('إلغاء الحذف متاح للمالك فقط');
    }

    await this.platformPrisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'active',
        pendingDeletionAt: null,
      },
    });

    return { message: 'تم إلغاء طلب الحذف' };
  }
}
