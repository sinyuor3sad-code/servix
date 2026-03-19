import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FeaturesService } from './features.service';
import type { TenantFeatureResult, FeatureCheckResult } from './features.service';
import type { Feature } from '../../shared/database';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { CheckFeatureDto } from './dto/check-feature.dto';
import { JwtAuthGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';

@ApiTags('المميزات - Features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'features', version: '1' })
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'عرض جميع المميزات' })
  @ApiResponse({ status: 200, description: 'قائمة بجميع المميزات' })
  async findAll(): Promise<Feature[]> {
    return this.featuresService.findAll();
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'إنشاء ميزة جديدة (مدير فقط)' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الميزة بنجاح' })
  @ApiResponse({ status: 409, description: 'رمز الميزة مستخدم بالفعل' })
  async create(@Body() dto: CreateFeatureDto): Promise<Feature> {
    return this.featuresService.create(dto);
  }

  @Post('check')
  @ApiOperation({ summary: 'التحقق من تفعيل ميزة لمنشأة' })
  @ApiResponse({ status: 200, description: 'نتيجة التحقق من حالة الميزة' })
  async checkFeature(@Body() dto: CheckFeatureDto): Promise<FeatureCheckResult> {
    return this.featuresService.isFeatureEnabled(dto.tenantId, dto.featureCode);
  }

  @Get('tenant/:tenantId')
  @ApiOperation({ summary: 'عرض المميزات المفعلة لمنشأة' })
  @ApiParam({ name: 'tenantId', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'قائمة المميزات المفعلة للمنشأة' })
  @ApiResponse({ status: 404, description: 'المنشأة غير موجودة' })
  async getTenantFeatures(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<TenantFeatureResult[]> {
    return this.featuresService.getTenantFeatures(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'عرض تفاصيل ميزة' })
  @ApiParam({ name: 'id', description: 'معرف الميزة (UUID)' })
  @ApiResponse({ status: 200, description: 'تفاصيل الميزة' })
  @ApiResponse({ status: 404, description: 'الميزة غير موجودة' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Feature> {
    return this.featuresService.findOne(id);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'تحديث ميزة (مدير فقط)' })
  @ApiParam({ name: 'id', description: 'معرف الميزة (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تحديث الميزة بنجاح' })
  @ApiResponse({ status: 404, description: 'الميزة غير موجودة' })
  @ApiResponse({ status: 409, description: 'رمز الميزة مستخدم بالفعل' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureDto,
  ): Promise<Feature> {
    return this.featuresService.update(id, dto);
  }
}
