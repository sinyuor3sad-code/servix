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
  ApiQuery,
} from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('العملاء - Clients')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'clients', version: '1' })
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة العملاء', description: 'عرض جميع العملاء مع التصفية والترحيل' })
  @ApiResponse({ status: 200, description: 'تم جلب قائمة العملاء بنجاح' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryClientsDto,
  ): Promise<Record<string, unknown>> {
    const result = await this.clientsService.findAll(
      req.tenantDb!,
      query,
    );
    return {
      success: true,
      data: result.data,
      message: 'تم جلب قائمة العملاء بنجاح',
      meta: result.meta,
    };
  }

  @Post()
  @ApiOperation({ summary: 'إضافة عميل', description: 'إنشاء عميل جديد' })
  @ApiResponse({ status: 201, description: 'تم إنشاء العميل بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateClientDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.clientsService.create(
      req.tenantDb!,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم إنشاء العميل بنجاح',
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'بحث سريع', description: 'بحث سريع عن العملاء بالاسم أو رقم الجوال' })
  @ApiQuery({ name: 'q', description: 'نص البحث', required: true })
  @ApiResponse({ status: 200, description: 'تم البحث بنجاح' })
  async search(
    @Req() req: AuthenticatedRequest,
    @Query('q') q: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.clientsService.search(
      req.tenantDb!,
      q || '',
    );
    return {
      success: true,
      data,
      message: 'تم البحث بنجاح',
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'إحصائيات العملاء', description: 'عرض إحصائيات عامة عن العملاء' })
  @ApiResponse({ status: 200, description: 'تم جلب الإحصائيات بنجاح' })
  async getStats(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    const data = await this.clientsService.getStats(
      req.tenantDb!,
    );
    return {
      success: true,
      data,
      message: 'تم جلب الإحصائيات بنجاح',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل العميل', description: 'عرض بيانات عميل محدد' })
  @ApiParam({ name: 'id', description: 'معرّف العميل' })
  @ApiResponse({ status: 200, description: 'تم جلب بيانات العميل بنجاح' })
  @ApiResponse({ status: 404, description: 'العميل غير موجود' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.clientsService.findOne(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم جلب بيانات العميل بنجاح',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث العميل', description: 'تعديل بيانات عميل محدد' })
  @ApiParam({ name: 'id', description: 'معرّف العميل' })
  @ApiResponse({ status: 200, description: 'تم تحديث بيانات العميل بنجاح' })
  @ApiResponse({ status: 404, description: 'العميل غير موجود' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.clientsService.update(
      req.tenantDb!,
      id,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم تحديث بيانات العميل بنجاح',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف العميل', description: 'حذف ناعم للعميل (تعيين تاريخ الحذف)' })
  @ApiParam({ name: 'id', description: 'معرّف العميل' })
  @ApiResponse({ status: 200, description: 'تم حذف العميل بنجاح' })
  @ApiResponse({ status: 404, description: 'العميل غير موجود' })
  async softDelete(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.clientsService.softDelete(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم حذف العميل بنجاح',
    };
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'سجل الزيارات', description: 'عرض سجل مواعيد العميل' })
  @ApiParam({ name: 'id', description: 'معرّف العميل' })
  @ApiResponse({ status: 200, description: 'تم جلب سجل الزيارات بنجاح' })
  @ApiResponse({ status: 404, description: 'العميل غير موجود' })
  async getHistory(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.clientsService.getHistory(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم جلب سجل الزيارات بنجاح',
    };
  }

  @Get(':id/loyalty')
  @ApiOperation({ summary: 'نقاط الولاء', description: 'عرض نقاط ولاء العميل وآخر المعاملات' })
  @ApiParam({ name: 'id', description: 'معرّف العميل' })
  @ApiResponse({ status: 200, description: 'تم جلب نقاط الولاء بنجاح' })
  @ApiResponse({ status: 404, description: 'العميل غير موجود' })
  async getLoyalty(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.clientsService.getLoyalty(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم جلب نقاط الولاء بنجاح',
    };
  }
}
