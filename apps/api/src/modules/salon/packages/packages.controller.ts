import { Controller, Get, Post, Delete, Body, Param, Req, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Packages')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'packages', version: '1' })
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  @ApiOperation({ summary: 'عرض جميع الباقات' })
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.packagesService.findAll(req.tenantDb!);
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء باقة جديدة' })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreatePackageDto) {
    return this.packagesService.create(req.tenantDb!, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف باقة' })
  async remove(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.packagesService.remove(req.tenantDb!, id);
  }
}
