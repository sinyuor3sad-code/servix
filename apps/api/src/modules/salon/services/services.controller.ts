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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderServicesDto } from './dto/reorder.dto';
import { QueryServicesDto } from './dto/query-services.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Services')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'services', version: '1' })
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ─── Static routes first (before :id) ───

  @Get('categories')
  @ApiOperation({ summary: 'عرض جميع التصنيفات' })
  @ApiResponse({ status: 200, description: 'تم جلب التصنيفات بنجاح' })
  async findAllCategories(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>[]> {
    return this.servicesService.findAllCategories(
      req.tenantDb!,
    );
  }

  @Post('categories')
  @ApiOperation({ summary: 'إنشاء تصنيف جديد' })
  @ApiResponse({ status: 201, description: 'تم إنشاء التصنيف بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async createCategory(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCategoryDto,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.createCategory(
      req.tenantDb!,
      dto,
    );
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'تحديث تصنيف' })
  @ApiResponse({ status: 200, description: 'تم تحديث التصنيف بنجاح' })
  @ApiResponse({ status: 404, description: 'التصنيف غير موجود' })
  async updateCategory(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.updateCategory(
      req.tenantDb!,
      id,
      dto,
    );
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'حذف تصنيف' })
  @ApiResponse({ status: 200, description: 'تم حذف التصنيف بنجاح' })
  @ApiResponse({ status: 404, description: 'التصنيف غير موجود' })
  async deleteCategory(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.deleteCategory(
      req.tenantDb!,
      id,
    );
  }

  @Put('reorder')
  @ApiOperation({ summary: 'إعادة ترتيب الخدمات' })
  @ApiResponse({ status: 200, description: 'تم إعادة ترتيب الخدمات بنجاح' })
  async reorder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReorderServicesDto,
  ): Promise<{ updated: number }> {
    return this.servicesService.reorder(
      req.tenantDb!,
      dto,
    );
  }

  // ─── Parameterized routes ───

  @Get()
  @ApiOperation({ summary: 'عرض جميع الخدمات' })
  @ApiResponse({ status: 200, description: 'تم جلب الخدمات بنجاح' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryServicesDto,
  ) {
    return this.servicesService.findAll(
      req.tenantDb!,
      query,
    );
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء خدمة جديدة' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الخدمة بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 404, description: 'التصنيف غير موجود' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateServiceDto,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.create(
      req.tenantDb!,
      dto,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'عرض تفاصيل خدمة' })
  @ApiResponse({ status: 200, description: 'تم جلب تفاصيل الخدمة بنجاح' })
  @ApiResponse({ status: 404, description: 'الخدمة غير موجودة' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.findOne(
      req.tenantDb!,
      id,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث خدمة' })
  @ApiResponse({ status: 200, description: 'تم تحديث الخدمة بنجاح' })
  @ApiResponse({ status: 404, description: 'الخدمة غير موجودة' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<Record<string, unknown>> {
    return this.servicesService.update(
      req.tenantDb!,
      id,
      dto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف خدمة' })
  @ApiResponse({ status: 200, description: 'تم حذف الخدمة بنجاح' })
  @ApiResponse({ status: 404, description: 'الخدمة غير موجودة' })
  async hardDelete(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: boolean; message: string }> {
    return this.servicesService.hardDelete(
      req.tenantDb!,
      id,
    );
  }
}
