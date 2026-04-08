import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { RolesGuard } from '../../shared/guards';
import { Roles, CurrentUser, Public } from '../../shared/decorators';
import { RateLimit } from '../../shared/guards/rate-limit.guard';
import { TenantsService } from '../tenants/tenants.service';
import { CircuitBreakerService } from '../../shared/resilience/circuit-breaker.service';
import { CreateTenantDto } from '../tenants/dto/create-tenant.dto';
import {
  GetTenantsDto,
  UpdateTenantStatusDto,
  GetSubscriptionsDto,
  GetInvoicesDto,
  GetAuditLogsDto,
  AdminLoginDto,
  AdminRefreshDto,
  UpdateSettingsDto,
  TriggerBackupDto,
  CreateNotificationDto,
  GetNotificationsDto,
  CreateCouponDto,
  UpdateCouponDto,
  GetCouponsDto,
  GetPaymentsDto,
  GetRenewalsDto,
  UpdateSubscriptionDto,
  ExtendTrialDto,
} from './admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('super_admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly tenantsService: TenantsService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  @Post('auth/login')
  @Public()
  @Roles()
  @RateLimit(5, 300)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تسجيل دخول مدير المنصة' })
  @ApiResponse({ status: 200, description: 'تم تسجيل الدخول بنجاح' })
  @ApiResponse({ status: 401, description: 'بيانات الدخول غير صحيحة' })
  async login(
    @Body() dto: AdminLoginDto,
  ): Promise<{
    user: { id: string; email: string; fullName: string; role: string };
    accessToken: string;
    refreshToken: string;
  }> {
    return this.adminService.login(dto.email, dto.password);
  }

  @Get('stats')
  @ApiOperation({ summary: 'إحصائيات شاملة للمنصة' })
  @ApiResponse({ status: 200, description: 'تم جلب الإحصائيات بنجاح' })
  async getStats() {
    return this.adminService.getStats();
  }

  // ═══════════════════ Users ═══════════════════

  @Get('users')
  @ApiOperation({ summary: 'عرض جميع المستخدمين المسجلين في المنصة' })
  @ApiResponse({ status: 200, description: 'قائمة المستخدمين مع حالة التحقق' })
  async getUsers(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('verified') verified?: string,
  ) {
    return this.adminService.getUsers({
      page: parseInt(page || '1', 10),
      perPage: parseInt(perPage || '20', 10),
      search: search || '',
      verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
    });
  }

  @Post('tenants')
  @ApiOperation({ summary: 'إنشاء منشأة جديدة من لوحة الإدارة' })
  @ApiResponse({ status: 201, description: 'تم إنشاء المنشأة بنجاح' })
  @ApiResponse({ status: 409, description: 'المعرف الفريد مستخدم بالفعل' })
  async createTenant(
    @Body() dto: CreateTenantDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.tenantsService.create(dto, adminId);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'عرض جميع المنشآت مع التصفية والبحث' })
  @ApiResponse({ status: 200, description: 'قائمة المنشآت' })
  async getTenants(
    @Query() dto: GetTenantsDto,
  ) {
    return this.adminService.getTenants(dto);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'عرض تفاصيل منشأة محددة' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تفاصيل المنشأة مع المستخدمين والاشتراكات' })
  @ApiResponse({ status: 404, description: 'المنشأة غير موجودة' })
  async getTenantById(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.getTenantById(id);
  }

  @Put('tenants/:id/status')
  @ApiOperation({ summary: 'تعليق أو تفعيل منشأة' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تحديث حالة المنشأة بنجاح' })
  @ApiResponse({ status: 400, description: 'المنشأة في نفس الحالة بالفعل' })
  @ApiResponse({ status: 404, description: 'المنشأة غير موجودة' })
  async updateTenantStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantStatusDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.updateTenantStatus(id, dto.status, userId);
  }

  // ═══════════════════ Force Actions ═══════════════════

  @Post('tenants/:id/force-logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تسجيل خروج إجباري لجميع مستخدمي منشأة' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تسجيل خروج جميع المستخدمين' })
  async forceLogoutTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.forceLogoutTenant(id, adminId);
  }

  @Post('tenants/:id/force-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إجبار جميع مستخدمي منشأة على تغيير كلمة المرور' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تم إجبار تغيير كلمة المرور' })
  async forcePasswordReset(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.forcePasswordReset(id, adminId);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'عرض جميع الاشتراكات' })
  @ApiResponse({ status: 200, description: 'قائمة الاشتراكات مع معلومات المنشأة والباقة' })
  async getSubscriptions(
    @Query() dto: GetSubscriptionsDto,
  ) {
    return this.adminService.getSubscriptions(dto);
  }

  @Get('subscriptions/:id')
  @ApiOperation({ summary: 'عرض تفاصيل اشتراك محدد' })
  @ApiParam({ name: 'id', description: 'معرف الاشتراك (UUID)' })
  @ApiResponse({ status: 200, description: 'تفاصيل الاشتراك الكاملة' })
  @ApiResponse({ status: 404, description: 'الاشتراك غير موجود' })
  async getSubscriptionById(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.getSubscriptionById(id);
  }

  @Put('subscriptions/:id')
  @ApiOperation({ summary: 'تعديل اشتراك (تغيير الباقة / الحالة / الدورة)' })
  @ApiParam({ name: 'id', description: 'معرف الاشتراك (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تعديل الاشتراك بنجاح' })
  @ApiResponse({ status: 404, description: 'الاشتراك غير موجود' })
  async updateSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.updateSubscription(id, dto, userId);
  }

  @Post('subscriptions/:id/extend-trial')
  @ApiOperation({ summary: 'تمديد فترة التجربة' })
  @ApiParam({ name: 'id', description: 'معرف الاشتراك (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تمديد التجربة بنجاح' })
  @ApiResponse({ status: 404, description: 'الاشتراك غير موجود' })
  async extendTrial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendTrialDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.extendTrial(id, dto, userId);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'عرض فواتير المنصة' })
  @ApiResponse({ status: 200, description: 'قائمة الفواتير مع معلومات المنشأة' })
  async getInvoices(
    @Query() dto: GetInvoicesDto,
  ) {
    return this.adminService.getInvoices(dto);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'عرض سجل العمليات' })
  @ApiResponse({ status: 200, description: 'سجل العمليات مع معلومات المستخدم' })
  async getAuditLogs(
    @Query() dto: GetAuditLogsDto,
  ) {
    return this.adminService.getAuditLogs(dto);
  }

  @Get('plans')
  @ApiOperation({ summary: 'عرض جميع الباقات مع عدد المشتركين' })
  @ApiResponse({ status: 200, description: 'قائمة الباقات مع المميزات' })
  async getPlans() {
    return this.adminService.getPlans();
  }

  @Put('plans/:id')
  @ApiOperation({ summary: 'تعديل بيانات باقة' })
  @ApiParam({ name: 'id', description: 'معرف الباقة (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تعديل الباقة بنجاح' })
  @ApiResponse({ status: 404, description: 'الباقة غير موجودة' })
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.updatePlan(id, dto, userId);
  }

  @Post('plans')
  @ApiOperation({ summary: 'إنشاء باقة جديدة' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الباقة بنجاح' })
  async createPlan(
    @Body() dto: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.createPlan(dto, userId);
  }

  @Put('plans/:id/features')
  @ApiOperation({ summary: 'تحديث ميزات الباقة' })
  @ApiParam({ name: 'id', description: 'معرف الباقة (UUID)' })
  async updatePlanFeatures(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { featureIds: string[] },
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.updatePlanFeatures(id, dto.featureIds, userId);
  }

  @Post('plans/:id/duplicate')
  @ApiOperation({ summary: 'تكرار باقة' })
  @ApiParam({ name: 'id', description: 'معرف الباقة المصدر (UUID)' })
  async duplicatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.duplicatePlan(id, userId);
  }

  @Get('features/catalog')
  @ApiOperation({ summary: 'عرض كتالوج الميزات الكامل' })
  async getFeatureCatalog() {
    return this.adminService.getFeatureCatalog();
  }

  @Get('addons')
  @ApiOperation({ summary: 'عرض جميع الإضافات' })
  async getAddons() {
    return this.adminService.getAddons();
  }

  @Post('addons')
  @ApiOperation({ summary: 'إنشاء إضافة جديدة' })
  async createAddon(
    @Body() dto: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.createAddon(dto, userId);
  }

  @Put('addons/:id')
  @ApiOperation({ summary: 'تحديث إضافة' })
  @ApiParam({ name: 'id', description: 'معرف الإضافة (UUID)' })
  async updateAddon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.updateAddon(id, dto, userId);
  }

  @Get('tenants/:id/overrides')
  @ApiOperation({ summary: 'عرض إعدادات المنشأة المخصصة' })
  async getTenantOverrides(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.getTenantOverrides(id);
  }

  @Put('tenants/:id/overrides')
  @ApiOperation({ summary: 'تحديث إعدادات المنشأة المخصصة' })
  async setTenantOverrides(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { overrides: { featureId: string; isEnabled: boolean }[] },
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.setTenantOverrides(id, dto.overrides, userId);
  }

  // ═══════════════════ Token Refresh ═══════════════════

  @Post('auth/refresh')
  @Public()
  @Roles()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تحديث رمز الدخول' })
  @ApiResponse({ status: 200, description: 'تم التحديث بنجاح' })
  @ApiResponse({ status: 401, description: 'رمز التحديث غير صالح' })
  async refreshToken(@Body() dto: AdminRefreshDto) {
    return this.adminService.refreshToken(dto.refreshToken);
  }

  // ═══════════════════ Settings ═══════════════════

  @Get('settings')
  @ApiOperation({ summary: 'جلب إعدادات المنصة' })
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'تحديث إعدادات المنصة' })
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.updateSettings(dto.settings, userId);
  }

  // ═══════════════════ Backups ═══════════════════

  @Get('backups')
  @ApiOperation({ summary: 'جلب حالة النسخ الاحتياطي لجميع الصالونات' })
  async getBackups() {
    return this.adminService.getBackupsByTenant();
  }

  @Post('backups/trigger')
  @ApiOperation({ summary: 'تنفيذ نسخ احتياطي يدوي لصالون' })
  async triggerBackup(
    @Body() dto: TriggerBackupDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.triggerBackup(dto.tenantId, userId);
  }

  // ═══════════════════ Notifications ═══════════════════

  @Get('notifications')
  @ApiOperation({ summary: 'جلب الإشعارات الجماعية' })
  async getNotifications(@Query() dto: GetNotificationsDto) {
    return this.adminService.getNotifications(dto);
  }

  @Post('notifications')
  @ApiOperation({ summary: 'إنشاء إشعار جماعي جديد' })
  async createNotification(
    @Body() dto: CreateNotificationDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.createNotification(dto, userId);
  }

  // ═══════════════════ Coupons ═══════════════════

  @Get('coupons')
  @ApiOperation({ summary: 'جلب كوبونات المنصة' })
  async getCoupons(@Query() dto: GetCouponsDto) {
    return this.adminService.getCoupons(dto);
  }

  @Post('coupons')
  @ApiOperation({ summary: 'إنشاء كوبون جديد' })
  async createCoupon(@Body() dto: CreateCouponDto) {
    return this.adminService.createCoupon(dto);
  }

  @Put('coupons/:id')
  @ApiOperation({ summary: 'تعديل كوبون' })
  async updateCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.adminService.updateCoupon(id, dto);
  }

  @Post('coupons/:id/delete')
  @ApiOperation({ summary: 'حذف كوبون' })
  async deleteCoupon(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteCoupon(id);
  }

  // ═══════════════════ Payments ═══════════════════

  @Get('payments')
  @ApiOperation({ summary: 'جلب سجل المدفوعات' })
  async getPayments(@Query() dto: GetPaymentsDto) {
    return this.adminService.getPayments(dto);
  }

  // ═══════════════════ Renewals ═══════════════════

  @Get('renewals')
  @ApiOperation({ summary: 'جلب التجديدات' })
  async getRenewals(@Query() dto: GetRenewalsDto) {
    return this.adminService.getRenewals(dto);
  }

  // ═══════════════════ Circuit Breakers (4.4) ═══════════════════

  @Get('circuit-breakers')
  @ApiOperation({ summary: 'حالة جميع دوائر القطع' })
  @ApiResponse({ status: 200, description: 'حالة الخدمات الخارجية' })
  async getCircuitBreakers() {
    return this.circuitBreakerService.getAllStates();
  }
}
