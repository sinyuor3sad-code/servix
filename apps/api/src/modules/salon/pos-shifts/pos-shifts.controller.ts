import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PosShiftsService } from './pos-shifts.service';
import { HeldBillsService } from './held-bills.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateHeldBillDto } from './dto/create-held-bill.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('POS Shifts')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'pos-shifts', version: '1' })
export class PosShiftsController {
  constructor(
    private readonly posShiftsService: PosShiftsService,
    private readonly heldBillsService: HeldBillsService,
  ) {}

  // ─── Held bills (must come before :id route) ───

  @Get('held-bills')
  @ApiOperation({ summary: 'الفواتير المعلّقة للوردية الحالية' })
  @ApiResponse({ status: 200, description: 'قائمة الفواتير المعلّقة' })
  async listHeldBills(@Req() req: AuthenticatedRequest) {
    return this.heldBillsService.list(req.tenantDb!);
  }

  @Post('held-bills')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'تعليق فاتورة' })
  @ApiResponse({ status: 201, description: 'تم تعليق الفاتورة' })
  @ApiResponse({ status: 400, description: 'وردية مغلقة أو سلة فارغة' })
  async createHeldBill(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateHeldBillDto,
  ) {
    return this.heldBillsService.create(req.tenantDb!, dto, req.user.sub);
  }

  @Delete('held-bills/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف فاتورة معلّقة' })
  @ApiResponse({ status: 204, description: 'تم الحذف' })
  @ApiResponse({ status: 404, description: 'الفاتورة المعلّقة غير موجودة' })
  async deleteHeldBill(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.heldBillsService.remove(req.tenantDb!, id);
  }

  @Get('current')
  @ApiOperation({ summary: 'جلب الوردية المفتوحة الحالية' })
  @ApiResponse({ status: 200, description: 'الوردية المفتوحة' })
  @ApiResponse({ status: 404, description: 'لا توجد وردية مفتوحة' })
  async getCurrent(@Req() req: AuthenticatedRequest) {
    const shift = await this.posShiftsService.getCurrent(req.tenantDb!);
    if (!shift) {
      throw new NotFoundException('لا توجد وردية مفتوحة');
    }
    return shift;
  }

  @Post('open')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'فتح وردية جديدة' })
  @ApiResponse({ status: 201, description: 'تم فتح الوردية بنجاح' })
  @ApiResponse({ status: 409, description: 'يوجد وردية مفتوحة بالفعل' })
  async open(
    @Req() req: AuthenticatedRequest,
    @Body() dto: OpenShiftDto,
  ) {
    return this.posShiftsService.open(req.tenantDb!, dto, req.user.sub);
  }

  @Post('close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إغلاق الوردية الحالية' })
  @ApiResponse({ status: 200, description: 'تم إغلاق الوردية بنجاح' })
  @ApiResponse({ status: 404, description: 'لا توجد وردية مفتوحة' })
  async close(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CloseShiftDto,
  ) {
    return this.posShiftsService.close(req.tenantDb!, dto, req.user.sub);
  }

  @Get(':id/report')
  @ApiOperation({ summary: 'تقرير وردية مفصل (Z-Report)' })
  @ApiResponse({ status: 200, description: 'تقرير الوردية' })
  @ApiResponse({ status: 404, description: 'الوردية غير موجودة' })
  async getReport(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posShiftsService.getReport(req.tenantDb!, id);
  }
}
