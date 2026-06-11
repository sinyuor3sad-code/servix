import {
  Controller,
  Get,
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
import { AuditService } from './audit.service';
import type { AuditLogWithUser } from './audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';

// V-idor-sweep (MEDIUM / cross-tenant info disclosure): platform_audit_logs spans
// ALL tenants. Pre-fix the class carried only JwtAuthGuard with no @Roles, so any
// authenticated user could read every tenant's audit trail (findAll/findOne) —
// who logged in, when, from which IP, what changed. Locked to super_admin
// (fail-closed, class scope), matching AdminController. Role resolved server-side
// from the verified JWT roleId.
@ApiTags('سجل المراجعة - Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'عرض سجلات المراجعة مع الفلترة' })
  @ApiResponse({ status: 200, description: 'قائمة سجلات المراجعة' })
  async findAll(
    @Query() query: QueryAuditLogDto,
  ): Promise<{
    data: AuditLogWithUser[];
    meta: { page: number; perPage: number; total: number; totalPages: number };
  }> {
    return this.auditService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'عرض تفاصيل سجل مراجعة واحد' })
  @ApiParam({ name: 'id', description: 'معرف سجل المراجعة (UUID)' })
  @ApiResponse({ status: 200, description: 'تفاصيل سجل المراجعة' })
  @ApiResponse({ status: 404, description: 'سجل المراجعة غير موجود' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AuditLogWithUser> {
    return this.auditService.findOne(id);
  }
}
