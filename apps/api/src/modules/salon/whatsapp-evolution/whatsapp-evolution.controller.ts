import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { WhatsAppEvolutionService } from './whatsapp-evolution.service';
import { WhatsAppAntiBanService } from './whatsapp-anti-ban.service';
import { SendMessageDto, SendMediaDto, AddOptOutDto } from './dto/send-message.dto';

@ApiTags('واتساب (Evolution API)')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'salon/whatsapp/evolution', version: '1' })
export class WhatsAppEvolutionController {
  constructor(
    private readonly evolution: WhatsAppEvolutionService,
    private readonly antiBan: WhatsAppAntiBanService,
    private readonly platformDb: PlatformPrismaClient,
  ) {}

  // ═════════ Instance management ═════════

  @Post('instance')
  @ApiOperation({ summary: 'إنشاء / جلب مثيل واتساب للصالون' })
  async createOrGetInstance(@Req() req: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(req);
    const tenantSlug = req.tenant?.slug;
    if (!tenantSlug) throw new BadRequestException('Tenant slug missing');

    const instance = await this.evolution.getOrCreateInstance(tenantId, tenantSlug);
    const qrCode = instance.status === 'qr_pending' || instance.status === 'disconnected'
      ? await this.evolution.fetchQrCode(instance.instanceName)
      : null;

    return {
      success: true,
      data: this.publicInstance(instance, qrCode),
    };
  }

  @Get('instance/status')
  @ApiOperation({ summary: 'حالة الاتصال + QR إذا لزم' })
  async status(@Req() req: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(req);
    const instance = await this.platformDb.whatsAppInstance.findUnique({
      where: { tenantId },
    });
    if (!instance) {
      return { success: true, data: null };
    }
    const synced = await this.evolution.syncInstanceStatus(instance.instanceName);
    const effective = synced ?? instance;
    const qrCode =
      effective.status === 'qr_pending' || effective.status === 'disconnected'
        ? await this.evolution.fetchQrCode(effective.instanceName)
        : null;
    return { success: true, data: this.publicInstance(effective, qrCode) };
  }

  @Post('instance/reconnect')
  @ApiOperation({ summary: 'إعادة إنشاء QR لإعادة الربط' })
  async reconnect(@Req() req: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(req);
    const instance = await this.platformDb.whatsAppInstance.findUnique({
      where: { tenantId },
    });
    if (!instance) throw new NotFoundException('لا يوجد مثيل للصالون');

    // Logout first to force a fresh QR generation
    if (instance.status === 'connected' || instance.status === 'connecting') {
      await this.evolution.logoutInstance(instance.instanceName);
    }

    // Request fresh QR from Evolution (this also triggers connection flow)
    const qrCode = await this.evolution.fetchQrCode(instance.instanceName);

    // Update DB status so the UI shows the QR section
    await this.platformDb.whatsAppInstance.update({
      where: { tenantId },
      data: { status: 'qr_pending' },
    });

    return { success: true, data: { qrCode } };
  }

  @Delete('instance')
  @ApiOperation({ summary: 'حذف المثيل وفصل واتساب' })
  @HttpCode(200)
  async deleteInstance(@Req() req: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(req);
    const instance = await this.platformDb.whatsAppInstance.findUnique({
      where: { tenantId },
    });
    if (!instance) return { success: true };

    await this.evolution.logoutInstance(instance.instanceName);
    await this.evolution.deleteInstance(instance.instanceName);
    await this.platformDb.whatsAppInstance.delete({ where: { tenantId } });
    return { success: true };
  }

  // ═════════ Messaging ═════════

  @Post('send')
  @ApiOperation({ summary: 'إرسال رسالة نصية (يطبّق قواعد مكافحة الحظر)' })
  async send(@Req() req: AuthenticatedRequest, @Body() dto: SendMessageDto) {
    const tenantId = this.requireTenantId(req);
    const instance = await this.getActiveInstance(tenantId);

    const decision = await this.antiBan.check({
      tenantId,
      tenantDb: req.tenantDb!,
      phone: dto.to,
      isMarketing: dto.isMarketing ?? false,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(`blocked: ${decision.reason}`);
    }

    await this.evolution.sendText({
      instanceName: instance.instanceName,
      instanceToken: instance.instanceToken,
      to: dto.to,
      message: dto.message,
      delayMs: decision.delayMs,
    });
    return { success: true, data: { delayMs: decision.delayMs } };
  }

  @Post('send-media')
  @ApiOperation({ summary: 'إرسال وسائط (صورة / مستند / صوت / فيديو)' })
  async sendMedia(@Req() req: AuthenticatedRequest, @Body() dto: SendMediaDto) {
    const tenantId = this.requireTenantId(req);
    const instance = await this.getActiveInstance(tenantId);

    const decision = await this.antiBan.check({
      tenantId,
      tenantDb: req.tenantDb!,
      phone: dto.to,
      isMarketing: dto.isMarketing ?? false,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(`blocked: ${decision.reason}`);
    }

    await this.evolution.sendMedia({
      instanceName: instance.instanceName,
      instanceToken: instance.instanceToken,
      to: dto.to,
      message: dto.caption ?? '',
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType,
      filename: dto.filename,
      caption: dto.caption,
      delayMs: decision.delayMs,
    });
    return { success: true, data: { delayMs: decision.delayMs } };
  }

  // ═════════ Opt-outs ═════════

  @Get('opt-outs')
  @ApiOperation({ summary: 'قائمة أرقام ملغى اشتراكها' })
  async listOptOuts(@Req() req: AuthenticatedRequest) {
    const items = await this.antiBan.listOptOuts(req.tenantDb!);
    return { success: true, data: items };
  }

  @Post('opt-outs')
  @ApiOperation({ summary: 'إضافة رقم إلى قائمة إلغاء الاشتراك' })
  async addOptOut(@Req() req: AuthenticatedRequest, @Body() dto: AddOptOutDto) {
    await this.antiBan.addOptOut(req.tenantDb!, dto.phone, dto.reason);
    return { success: true };
  }

  @Delete('opt-outs/:phone')
  @ApiOperation({ summary: 'إزالة رقم من قائمة إلغاء الاشتراك' })
  @ApiParam({ name: 'phone' })
  @HttpCode(200)
  async removeOptOut(@Req() req: AuthenticatedRequest, @Param('phone') phone: string) {
    await this.antiBan.removeOptOut(req.tenantDb!, phone);
    return { success: true };
  }

  // ═════════ Helpers ═════════

  private requireTenantId(req: AuthenticatedRequest): string {
    const id = req.tenant?.id;
    if (!id) throw new BadRequestException('Tenant context missing');
    return id;
  }

  private async getActiveInstance(tenantId: string) {
    const instance = await this.platformDb.whatsAppInstance.findUnique({
      where: { tenantId },
    });
    if (!instance) throw new NotFoundException('الصالون غير مربوط بواتساب بعد');
    if (instance.status !== 'connected') {
      throw new BadRequestException(`لا يمكن الإرسال والحالة: ${instance.status}`);
    }
    return instance;
  }

  private publicInstance(
    instance: { instanceName: string; status: string; phoneNumber: string | null; profileName: string | null; profilePicUrl: string | null; lastConnectedAt: Date | null },
    qrCode: string | null,
  ) {
    return {
      instanceName: instance.instanceName,
      status: instance.status,
      phoneNumber: instance.phoneNumber,
      profileName: instance.profileName,
      profilePicUrl: instance.profilePicUrl,
      lastConnectedAt: instance.lastConnectedAt,
      qrCode,
    };
  }
}
