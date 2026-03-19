import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('المواعيد - Appointments')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة المواعيد', description: 'عرض جميع المواعيد مع التصفية والترحيل' })
  @ApiResponse({ status: 200, description: 'تم جلب قائمة المواعيد بنجاح' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAppointmentsDto,
  ): Promise<Record<string, unknown>> {
    const result = await this.appointmentsService.findAll(
      req.tenantDb!,
      query,
    );
    return {
      success: true,
      data: result.data,
      message: 'تم جلب قائمة المواعيد بنجاح',
      meta: result.meta,
    };
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء موعد', description: 'حجز موعد جديد مع خدمات' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الموعد بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 409, description: 'تعارض في المواعيد' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAppointmentDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.appointmentsService.create(
      req.tenantDb!,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم إنشاء الموعد بنجاح',
    };
  }

  @Get('today')
  @ApiOperation({ summary: 'مواعيد اليوم', description: 'عرض مواعيد اليوم الحالي' })
  @ApiResponse({ status: 200, description: 'تم جلب مواعيد اليوم بنجاح' })
  async getToday(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    const data = await this.appointmentsService.getToday(
      req.tenantDb!,
    );
    return {
      success: true,
      data,
      message: 'تم جلب مواعيد اليوم بنجاح',
    };
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'المواعيد القادمة', description: 'عرض المواعيد خلال الأيام السبعة القادمة' })
  @ApiResponse({ status: 200, description: 'تم جلب المواعيد القادمة بنجاح' })
  async getUpcoming(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    const data = await this.appointmentsService.getUpcoming(
      req.tenantDb!,
    );
    return {
      success: true,
      data,
      message: 'تم جلب المواعيد القادمة بنجاح',
    };
  }

  @Get('available-slots')
  @ApiOperation({
    summary: 'الفترات المتاحة',
    description: 'حساب الفترات الزمنية المتاحة لتاريخ وخدمات محددة',
  })
  @ApiResponse({ status: 200, description: 'تم جلب الفترات المتاحة بنجاح' })
  async getAvailableSlots(
    @Req() req: AuthenticatedRequest,
    @Query() query: AvailableSlotsDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.appointmentsService.getAvailableSlots(
      req.tenantDb!,
      query,
    );
    return {
      success: true,
      data,
      message: 'تم جلب الفترات المتاحة بنجاح',
    };
  }

  @Get('calendar')
  @ApiOperation({ summary: 'عرض التقويم', description: 'عرض المواعيد مجمّعة حسب التاريخ' })
  @ApiResponse({ status: 200, description: 'تم جلب بيانات التقويم بنجاح' })
  async getCalendar(
    @Req() req: AuthenticatedRequest,
    @Query() query: CalendarQueryDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.appointmentsService.getCalendar(
      req.tenantDb!,
      query,
    );
    return {
      success: true,
      data,
      message: 'تم جلب بيانات التقويم بنجاح',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل الموعد', description: 'عرض بيانات موعد محدد مع جميع العلاقات' })
  @ApiParam({ name: 'id', description: 'معرّف الموعد' })
  @ApiResponse({ status: 200, description: 'تم جلب بيانات الموعد بنجاح' })
  @ApiResponse({ status: 404, description: 'الموعد غير موجود' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.appointmentsService.findOne(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم جلب بيانات الموعد بنجاح',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث الموعد', description: 'تعديل بيانات موعد (معلّق أو مؤكد فقط)' })
  @ApiParam({ name: 'id', description: 'معرّف الموعد' })
  @ApiResponse({ status: 200, description: 'تم تحديث الموعد بنجاح' })
  @ApiResponse({ status: 400, description: 'لا يمكن تعديل الموعد بحالته الحالية' })
  @ApiResponse({ status: 404, description: 'الموعد غير موجود' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.appointmentsService.update(
      req.tenantDb!,
      id,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم تحديث الموعد بنجاح',
    };
  }

  @Put(':id/status')
  @ApiOperation({
    summary: 'تغيير حالة الموعد',
    description: 'تغيير حالة الموعد (تأكيد، بدء، إكمال، إلغاء، لم يحضر)',
  })
  @ApiParam({ name: 'id', description: 'معرّف الموعد' })
  @ApiResponse({ status: 200, description: 'تم تغيير حالة الموعد بنجاح' })
  @ApiResponse({ status: 400, description: 'تغيير الحالة غير مسموح' })
  @ApiResponse({ status: 404, description: 'الموعد غير موجود' })
  async changeStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.appointmentsService.changeStatus(
      req.tenantDb!,
      id,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم تغيير حالة الموعد بنجاح',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'إلغاء الموعد', description: 'إلغاء موعد محدد' })
  @ApiParam({ name: 'id', description: 'معرّف الموعد' })
  @ApiResponse({ status: 200, description: 'تم إلغاء الموعد بنجاح' })
  @ApiResponse({ status: 400, description: 'لا يمكن إلغاء الموعد بحالته الحالية' })
  @ApiResponse({ status: 404, description: 'الموعد غير موجود' })
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.appointmentsService.cancel(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم إلغاء الموعد بنجاح',
    };
  }
}
