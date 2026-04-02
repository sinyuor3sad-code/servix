import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  Res,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { AddDiscountDto } from './dto/add-discount.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('الفواتير - Invoices')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة الفواتير', description: 'عرض جميع الفواتير مع التصفية والترحيل' })
  @ApiResponse({ status: 200, description: 'تم جلب قائمة الفواتير بنجاح' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryInvoicesDto,
  ): Promise<Record<string, unknown>> {
    const result = await this.invoicesService.findAll(
      req.tenantDb!,
      query,
    );
    return {
      success: true,
      data: result,
      message: 'تم جلب قائمة الفواتير بنجاح',
    };
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء فاتورة', description: 'إنشاء فاتورة جديدة' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الفاتورة بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInvoiceDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.invoicesService.create(
      req.tenantDb!,
      dto,
      req.user.sub,
    );
    return {
      success: true,
      data,
      message: 'تم إنشاء الفاتورة بنجاح',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل الفاتورة', description: 'عرض بيانات فاتورة محددة' })
  @ApiParam({ name: 'id', description: 'معرّف الفاتورة' })
  @ApiResponse({ status: 200, description: 'تم جلب بيانات الفاتورة بنجاح' })
  @ApiResponse({ status: 404, description: 'الفاتورة غير موجودة' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.invoicesService.findOne(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم جلب بيانات الفاتورة بنجاح',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث الفاتورة', description: 'تعديل فاتورة مسودة فقط' })
  @ApiParam({ name: 'id', description: 'معرّف الفاتورة' })
  @ApiResponse({ status: 200, description: 'تم تحديث الفاتورة بنجاح' })
  @ApiResponse({ status: 400, description: 'لا يمكن تعديل فاتورة غير مسودة' })
  @ApiResponse({ status: 404, description: 'الفاتورة غير موجودة' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.invoicesService.update(
      req.tenantDb!,
      id,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم تحديث الفاتورة بنجاح',
    };
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'تسجيل دفعة', description: 'تسجيل دفعة على الفاتورة' })
  @ApiParam({ name: 'id', description: 'معرّف الفاتورة' })
  @ApiResponse({ status: 201, description: 'تم تسجيل الدفعة بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 404, description: 'الفاتورة غير موجودة' })
  async recordPayment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.invoicesService.recordPayment(
      req.tenantDb!,
      id,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم تسجيل الدفعة بنجاح',
    };
  }

  @Put(':id/void')
  @ApiOperation({ summary: 'إلغاء الفاتورة', description: 'إلغاء فاتورة' })
  @ApiParam({ name: 'id', description: 'معرّف الفاتورة' })
  @ApiResponse({ status: 200, description: 'تم إلغاء الفاتورة بنجاح' })
  @ApiResponse({ status: 400, description: 'لا يمكن إلغاء هذه الفاتورة' })
  @ApiResponse({ status: 404, description: 'الفاتورة غير موجودة' })
  async voidInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.invoicesService.voidInvoice(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم إلغاء الفاتورة بنجاح',
    };
  }

  @Post(':id/discount')
  @ApiOperation({ summary: 'إضافة خصم', description: 'إضافة خصم على الفاتورة' })
  @ApiParam({ name: 'id', description: 'معرّف الفاتورة' })
  @ApiResponse({ status: 201, description: 'تم إضافة الخصم بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 404, description: 'الفاتورة غير موجودة' })
  async addDiscount(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDiscountDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.invoicesService.addDiscount(
      req.tenantDb!,
      id,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم إضافة الخصم بنجاح',
    };
  }

  @Post(':id/coupon')
  @ApiOperation({ summary: 'تطبيق كوبون', description: 'تطبيق كود كوبون على الفاتورة' })
  @ApiParam({ name: 'id', description: 'معرّف الفاتورة' })
  @ApiResponse({ status: 201, description: 'تم تطبيق الكوبون بنجاح' })
  @ApiResponse({ status: 400, description: 'الكوبون غير صالح' })
  @ApiResponse({ status: 404, description: 'الفاتورة أو الكوبون غير موجود' })
  async applyCoupon(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyCouponDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.invoicesService.applyCoupon(
      req.tenantDb!,
      id,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم تطبيق الكوبون بنجاح',
    };
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'تحميل الفاتورة PDF', description: 'إنشاء وتحميل الفاتورة بصيغة PDF' })
  @ApiParam({ name: 'id', description: 'معرّف الفاتورة' })
  @ApiResponse({ status: 200, description: 'ملف PDF' })
  @ApiResponse({ status: 404, description: 'الفاتورة غير موجودة' })
  async getPdf(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const tenant = req.tenant!;
    const pdf = await this.invoicesService.getPdf(
      req.tenantDb!,
      id,
      {
        nameAr: tenant.nameAr,
        primaryColor: tenant.primaryColor,
        logoUrl: tenant.logoUrl,
      },
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    res.send(pdf);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'إرسال الفاتورة', description: 'إرسال الفاتورة عبر واتساب أو البريد أو الرسائل النصية' })
  @ApiParam({ name: 'id', description: 'معرّف الفاتورة' })
  @ApiResponse({ status: 200, description: 'تم الإرسال بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 404, description: 'الفاتورة غير موجودة' })
  async sendInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendInvoiceDto,
  ): Promise<Record<string, unknown>> {
    const tenant = req.tenant!;
    const result = await this.invoicesService.sendInvoice(
      req.tenantDb!,
      id,
      dto.channel,
      {
        nameAr: tenant.nameAr,
        primaryColor: tenant.primaryColor,
        logoUrl: tenant.logoUrl,
      },
      req.tenant?.id,
    );
    return {
      success: true,
      message: result.message,
    };
  }
}
