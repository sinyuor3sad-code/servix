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
} from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { SetServicesDto } from './dto/set-services.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { CreateEmployeeAccountDto } from './dto/create-employee-account.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'employees', version: '1' })
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'عرض جميع الموظفين' })
  @ApiResponse({ status: 200, description: 'تم جلب الموظفين بنجاح' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryEmployeesDto,
  ) {
    return this.employeesService.findAll(
      req.tenantDb!,
      query,
    );
  }

  @Post()
  @ApiOperation({ summary: 'إضافة موظف جديد' })
  @ApiResponse({ status: 201, description: 'تم إضافة الموظف بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateEmployeeDto,
  ): Promise<Record<string, unknown>> {
    return this.employeesService.create(
      req.tenantDb!,
      dto,
      req.user?.sub,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'عرض تفاصيل موظف' })
  @ApiResponse({ status: 200, description: 'تم جلب تفاصيل الموظف بنجاح' })
  @ApiResponse({ status: 404, description: 'الموظف غير موجود' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    return this.employeesService.findOne(
      req.tenantDb!,
      id,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث بيانات موظف' })
  @ApiResponse({ status: 200, description: 'تم تحديث بيانات الموظف بنجاح' })
  @ApiResponse({ status: 404, description: 'الموظف غير موجود' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<Record<string, unknown>> {
    return this.employeesService.update(
      req.tenantDb!,
      id,
      dto,
      req.user?.sub,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف موظف نهائياً' })
  @ApiResponse({ status: 200, description: 'تم حذف الموظف بنجاح' })
  @ApiResponse({ status: 404, description: 'الموظف غير موجود' })
  async deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    return this.employeesService.deactivate(
      req.tenantDb!,
      req.tenant!.id,
      id,
    );
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'عرض جدول عمل موظف' })
  @ApiResponse({ status: 200, description: 'تم جلب جدول العمل بنجاح' })
  @ApiResponse({ status: 404, description: 'الموظف غير موجود' })
  async getSchedule(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>[]> {
    return this.employeesService.getSchedule(
      req.tenantDb!,
      id,
    );
  }

  @Put(':id/schedule')
  @ApiOperation({ summary: 'تعيين جدول عمل موظف' })
  @ApiResponse({ status: 200, description: 'تم تحديث جدول العمل بنجاح' })
  @ApiResponse({ status: 404, description: 'الموظف غير موجود' })
  async setSchedule(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetScheduleDto,
  ): Promise<Record<string, unknown>[]> {
    return this.employeesService.setSchedule(
      req.tenantDb!,
      id,
      dto,
    );
  }

  @Get(':id/services')
  @ApiOperation({ summary: 'عرض الخدمات المخصصة للموظف' })
  @ApiResponse({
    status: 200,
    description: 'تم جلب خدمات الموظف بنجاح',
  })
  @ApiResponse({ status: 404, description: 'الموظف غير موجود' })
  async getAssignedServices(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>[]> {
    return this.employeesService.getAssignedServices(
      req.tenantDb!,
      id,
    );
  }

  @Put(':id/services')
  @ApiOperation({ summary: 'تعيين الخدمات للموظف' })
  @ApiResponse({
    status: 200,
    description: 'تم تعيين الخدمات للموظف بنجاح',
  })
  @ApiResponse({ status: 404, description: 'الموظف غير موجود' })
  async setAssignedServices(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetServicesDto,
  ): Promise<Record<string, unknown>[]> {
    return this.employeesService.setAssignedServices(
      req.tenantDb!,
      id,
      dto,
    );
  }

  @Post(':id/account')
  @ApiOperation({ summary: 'إنشاء حساب دخول لموظف (كاشير/مديرة/إلخ)' })
  @ApiResponse({ status: 201, description: 'تم إنشاء حساب الدخول بنجاح' })
  @ApiResponse({ status: 404, description: 'الموظف غير موجود' })
  @ApiResponse({ status: 409, description: 'البريد الإلكتروني مسجل مسبقاً' })
  async createAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEmployeeAccountDto,
  ): Promise<{ message: string; userId: string }> {
    return this.employeesService.createAccount(
      req.tenantDb!,
      req.tenant!.id,
      id,
      dto,
    );
  }
}
