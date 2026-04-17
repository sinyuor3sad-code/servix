import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Res,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';
import { AccountService } from './account.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@ApiTags('Account')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'account', version: '1' })
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post('export')
  @ApiOperation({ summary: 'تصدير بيانات الصالون (ZIP)' })
  @ApiResponse({ status: 200, description: 'ملف ZIP للتحميل' })
  @ApiResponse({ status: 403, description: 'المستخدم ليس مالكاً' })
  async exportData(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw new BadRequestException('سياق المستأجر مفقود');
    }
    const isOwner = await this.accountService.checkIsOwner(tenantId, req.user.sub);
    if (!isOwner) {
      throw new ForbiddenException('تصدير البيانات متاح للمالك فقط');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="servix-export-${req.tenant?.slug ?? 'data'}-${Date.now()}.zip"`,
    );

    await this.accountService.exportToZip(req.tenantDb!, res);
  }

  @Post('delete')
  @ApiOperation({ summary: 'طلب حذف الحساب (7 أيام مهلة)' })
  @ApiResponse({ status: 200, description: 'تم طلب الحذف. لديك 7 أيام للإلغاء' })
  @ApiResponse({ status: 400, description: 'تأكيد غير صحيح' })
  @ApiResponse({ status: 403, description: 'المستخدم ليس مالكاً' })
  async requestDeletion(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DeleteAccountDto,
  ): Promise<{ message: string; deletionAt: string }> {
    return this.accountService.requestDeletion(req, dto);
  }

  @Post('delete/cancel')
  @ApiOperation({ summary: 'إلغاء طلب حذف الحساب' })
  @ApiResponse({ status: 200, description: 'تم إلغاء طلب الحذف' })
  @ApiResponse({ status: 403, description: 'المستخدم ليس مالكاً' })
  async cancelDeletion(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.accountService.cancelDeletion(req);
  }
}
