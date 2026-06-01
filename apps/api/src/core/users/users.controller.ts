import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
import { UsersService } from './users.service';
import type { UserWithTenants } from './users.service';
import type { User } from '../../shared/database';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';

// V-idor-users (HIGH / cross-tenant IDOR + account takeover): these are
// platform user-administration routes over the shared platform users table.
// Pre-fix the class carried only JwtAuthGuard with no @Roles, so ANY
// authenticated user could GET /users (list every platform user's PII:
// email/phone), GET/PUT/DELETE /users/:id on any account — and PUT /users/:id
// can change another account's email/phone, an account-takeover vector (change
// email → password reset). Locked to super_admin (fail-closed, class scope).
// User self-service lives on the existing /auth/me routes (GET/PUT), so the full
// lock is regression-free. Role resolved server-side from the verified JWT.
@ApiTags('المستخدمون - Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'عرض قائمة المستخدمين' })
  @ApiResponse({ status: 200, description: 'قائمة المستخدمين مع التصفح' })
  async findAll(
    @Query() query: QueryUsersDto,
  ): Promise<{
    data: User[];
    meta: { page: number; perPage: number; total: number; totalPages: number };
  }> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'عرض تفاصيل مستخدم' })
  @ApiParam({ name: 'id', description: 'معرف المستخدم (UUID)' })
  @ApiResponse({ status: 200, description: 'تفاصيل المستخدم مع المنشآت المرتبطة' })
  @ApiResponse({ status: 404, description: 'المستخدم غير موجود' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserWithTenants> {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث بيانات مستخدم' })
  @ApiParam({ name: 'id', description: 'معرف المستخدم (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تحديث المستخدم بنجاح' })
  @ApiResponse({ status: 404, description: 'المستخدم غير موجود' })
  @ApiResponse({ status: 409, description: 'البريد أو الجوال مستخدم بالفعل' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'تعطيل حساب مستخدم' })
  @ApiParam({ name: 'id', description: 'معرف المستخدم (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تعطيل المستخدم بنجاح' })
  @ApiResponse({ status: 404, description: 'المستخدم غير موجود' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<User> {
    return this.usersService.deactivate(id);
  }
}
