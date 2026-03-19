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
import type { RoleWithPermissions, GroupedPermissions } from './roles.service';
import type { Role, Permission } from '../../shared/database';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { JwtAuthGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';

@ApiTags('الأدوار والصلاحيات - Roles & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  @Roles('admin')
  @ApiOperation({ summary: 'إنشاء دور جديد (مدير فقط)' })
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
  @Roles('admin')
  @ApiOperation({ summary: 'تحديث دور (مدير فقط، لا يمكن تعديل أدوار النظام)' })
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
  @Roles('admin')
  @ApiOperation({ summary: 'حذف دور (مدير فقط، لا يمكن حذف أدوار النظام)' })
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
  @Roles('admin')
  @ApiOperation({ summary: 'تعيين صلاحيات لدور (مدير فقط)' })
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
