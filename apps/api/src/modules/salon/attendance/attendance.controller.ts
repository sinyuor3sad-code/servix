import {
  Controller,
  Get,
  Post,
  Put,
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
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'attendance', version: '1' })
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('today')
  @ApiOperation({ summary: 'عرض حضور اليوم' })
  @ApiResponse({ status: 200, description: 'تم جلب حضور اليوم بنجاح' })
  async getToday(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>[]> {
    return this.attendanceService.getToday(
      req.tenantDb!,
    );
  }

  @Post('check-in')
  @ApiOperation({ summary: 'تسجيل حضور موظف' })
  @ApiResponse({ status: 201, description: 'تم تسجيل الحضور بنجاح' })
  @ApiResponse({ status: 400, description: 'الموظف سجّل حضوره مسبقاً' })
  @ApiResponse({ status: 404, description: 'الموظف غير موجود' })
  async checkIn(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CheckInDto,
  ): Promise<Record<string, unknown>> {
    return this.attendanceService.checkIn(
      req.tenantDb!,
      dto.employeeId,
      req.tenant?.id,
    );
  }

  @Put('check-out')
  @ApiOperation({ summary: 'تسجيل انصراف موظف' })
  @ApiResponse({ status: 200, description: 'تم تسجيل الانصراف بنجاح' })
  @ApiResponse({ status: 400, description: 'الموظف لم يسجّل حضوره' })
  async checkOut(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CheckInDto,
  ): Promise<Record<string, unknown>> {
    return this.attendanceService.checkOut(
      req.tenantDb!,
      dto.employeeId,
      req.tenant?.id,
    );
  }

  @Put('toggle-break')
  @ApiOperation({ summary: 'تبديل حالة الاستراحة' })
  @ApiResponse({ status: 200, description: 'تم تحديث حالة الاستراحة' })
  @ApiResponse({ status: 400, description: 'الموظف لم يسجّل حضوره أو أنهى دوامه' })
  async toggleBreak(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CheckInDto,
  ): Promise<Record<string, unknown>> {
    return this.attendanceService.toggleBreak(
      req.tenantDb!,
      dto.employeeId,
      req.tenant?.id,
    );
  }

  @Get('employee/:id')
  @ApiOperation({ summary: 'عرض سجل حضور موظف' })
  @ApiResponse({ status: 200, description: 'تم جلب سجل الحضور بنجاح' })
  @ApiResponse({ status: 404, description: 'الموظف غير موجود' })
  async getEmployeeHistory(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryAttendanceDto,
  ) {
    return this.attendanceService.getEmployeeHistory(
      req.tenantDb!,
      id,
      query,
    );
  }

  @Get()
  @ApiOperation({ summary: 'عرض جميع سجلات الحضور' })
  @ApiResponse({ status: 200, description: 'تم جلب سجلات الحضور بنجاح' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAttendanceDto,
  ) {
    return this.attendanceService.findAll(
      req.tenantDb!,
      query,
    );
  }
}
