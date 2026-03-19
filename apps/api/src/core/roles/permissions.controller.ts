import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import type { GroupedPermissions } from './roles.service';
import { JwtAuthGuard } from '../../shared/guards';

@ApiTags('الأدوار والصلاحيات - Roles & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'permissions', version: '1' })
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'عرض جميع الصلاحيات مجمعة حسب المجموعة' })
  @ApiResponse({ status: 200, description: 'قائمة الصلاحيات مجمعة حسب المجموعة' })
  async getPermissions(): Promise<GroupedPermissions[]> {
    return this.rolesService.getPermissions();
  }
}
