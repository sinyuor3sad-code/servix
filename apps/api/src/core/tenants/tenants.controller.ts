import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { TenantsService } from './tenants.service';
import type {
  TenantWithDetails,
  SubscriptionWithPlan,
  TenantFeatureWithFeature,
} from './tenants.service';
import type { Tenant } from '../../shared/database';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ToggleFeaturesDto } from './dto/toggle-features.dto';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { CurrentUser, Roles } from '../../shared/decorators';

// V-tenants-authz (HIGH / cross-tenant IDOR): every route here is a
// PLATFORM operation (create/suspend/update any tenant by :id, read any
// tenant's subscription, toggle any tenant's features). Pre-fix the class
// carried only JwtAuthGuard with no @Roles, and the global TenantGuard only
// checks the caller's OWN tenant (request.tenant from the JWT) — it never
// compares the :id path param — so ANY authenticated salon user could
// DELETE/PUT /tenants/<any-id>. Locked to super_admin, matching
// AdminController's pattern. The admin UI already drives all of this via the
// super_admin /admin/tenants/* routes; nothing legitimately calls bare
// /tenants/* as tenant self-service (dashboard uses /auth, /settings,
// /subscriptions). Fail-closed at class scope so any future route added here
// inherits the super_admin gate. See docs/principal-audit (V-tenants-authz).
@ApiTags('المنشآت - Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller({ path: 'tenants', version: '1' })
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'إنشاء منشأة جديدة' })
  @ApiResponse({ status: 201, description: 'تم إنشاء المنشأة بنجاح' })
  @ApiResponse({ status: 409, description: 'المعرف الفريد مستخدم بالفعل' })
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentUser('sub') ownerId: string,
  ): Promise<Tenant> {
    return this.tenantsService.create(dto, ownerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'عرض تفاصيل المنشأة' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تفاصيل المنشأة مع الاشتراك والمميزات' })
  @ApiResponse({ status: 404, description: 'المنشأة غير موجودة' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TenantWithDetails> {
    return this.tenantsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث بيانات المنشأة' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تحديث المنشأة بنجاح' })
  @ApiResponse({ status: 404, description: 'المنشأة غير موجودة' })
  @ApiResponse({ status: 409, description: 'المعرف الفريد مستخدم بالفعل' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<Tenant> {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'تعليق المنشأة' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تعليق المنشأة بنجاح' })
  @ApiResponse({ status: 404, description: 'المنشأة غير موجودة' })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorUserId: string,
  ): Promise<Tenant> {
    return this.tenantsService.suspend(id, actorUserId);
  }

  @Get(':id/subscription')
  @ApiOperation({ summary: 'عرض اشتراك المنشأة الحالي' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تفاصيل الاشتراك مع الباقة' })
  @ApiResponse({ status: 404, description: 'لا يوجد اشتراك حالي' })
  async getSubscription(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubscriptionWithPlan> {
    return this.tenantsService.getSubscription(id);
  }

  @Put(':id/features')
  @ApiOperation({ summary: 'تفعيل أو تعطيل مميزات المنشأة' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تحديث المميزات بنجاح' })
  @ApiResponse({ status: 404, description: 'المنشأة غير موجودة' })
  async toggleFeatures(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleFeaturesDto,
  ): Promise<TenantFeatureWithFeature[]> {
    return this.tenantsService.toggleFeatures(id, dto);
  }
}
