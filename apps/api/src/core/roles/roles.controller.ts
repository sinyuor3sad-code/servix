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
import { RolesService } from './roles.service';
import type { RoleWithPermissions } from './roles.service';
import type { Role, Permission } from '../../shared/database';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';

// V-idor-rbac (HIGH / privilege escalation): managing platform roles &
// permissions is a platform operation. Pre-fix the per-route @Roles('admin')
// decorators were INERT — RolesGuard is not a global APP_GUARD and was never
// applied at the class, so the metadata did nothing and ANY authenticated user
// could PUT /roles/:id/permissions (grant themselves arbitrary permissions =
// privilege escalation). Worse, 'admin' is not even a seeded role (the platform
// role is 'super_admin'; tenant roles are owner/manager/receptionist/cashier/
// staff), so the gate would have denied everyone anyway. Locked to super_admin
// at class scope (RolesGuard now actually runs), matching AdminController. The
// admin UI drives this; no tenant self-service touches /roles/*.
@ApiTags('الأدوار والصلاحيات - Roles & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'عرض جميع الأدوار' })
  @ApiResponse({ status: 200, description: 'قائمة بجميع الأدوار' })
  async findAll(): Promise<Role[]> {
    return this.rolesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء دور جديد (مدير المنصة فقط)' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الدور بنجاح' })
  @ApiResponse({ status: 409, description: 'اسم الدور مستخدم بالفعل' })
  async create(@Body() dto: CreateRoleDto): Promise<Role> {
    return this.rolesService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'عرض تفاصيل الدور مع الصلاحيات' })
  @ApiParam({ name: 'id', description: 'معرف الدور (UUID)' })
  @ApiResponse({ status: 200, description: 'تفاصيل الدور مع الصلاحيات' })
  @ApiResponse({ status: 404, description: 'الدور غير موجود' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoleWithPermissions> {
    return this.rolesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث دور (مدير المنصة فقط، لا يمكن تعديل أدوار النظام)' })
  @ApiParam({ name: 'id', description: 'معرف الدور (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تحديث الدور بنجاح' })
  @ApiResponse({ status: 400, description: 'لا يمكن تعديل الأدوار الأساسية للنظام' })
  @ApiResponse({ status: 404, description: 'الدور غير موجود' })
  @ApiResponse({ status: 409, description: 'اسم الدور مستخدم بالفعل' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<Role> {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف دور (مدير المنصة فقط، لا يمكن حذف أدوار النظام)' })
  @ApiParam({ name: 'id', description: 'معرف الدور (UUID)' })
  @ApiResponse({ status: 200, description: 'تم حذف الدور بنجاح' })
  @ApiResponse({ status: 400, description: 'لا يمكن حذف الأدوار الأساسية أو المرتبطة بمستخدمين' })
  @ApiResponse({ status: 404, description: 'الدور غير موجود' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<Role> {
    return this.rolesService.remove(id);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'عرض صلاحيات دور محدد' })
  @ApiParam({ name: 'id', description: 'معرف الدور (UUID)' })
  @ApiResponse({ status: 200, description: 'قائمة صلاحيات الدور' })
  @ApiResponse({ status: 404, description: 'الدور غير موجود' })
  async getRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Permission[]> {
    return this.rolesService.getRolePermissions(id);
  }

  @Put(':id/permissions')
  @ApiOperation({ summary: 'تعيين صلاحيات لدور (مدير المنصة فقط)' })
  @ApiParam({ name: 'id', description: 'معرف الدور (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تعيين الصلاحيات بنجاح' })
  @ApiResponse({ status: 400, description: 'لا يمكن تعديل صلاحيات أدوار النظام أو معرفات غير صالحة' })
  @ApiResponse({ status: 404, description: 'الدور غير موجود' })
  async setRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPermissionsDto,
  ): Promise<Permission[]> {
    return this.rolesService.setRolePermissions(id, dto);
  }
}
