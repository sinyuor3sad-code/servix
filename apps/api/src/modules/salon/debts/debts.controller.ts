import { Controller, Get, Post, Patch, Delete, Body, Param, Req, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DebtsService } from './debts.service';
import { CreateEmployeeDebtDto, CreateClientDebtDto } from './dto/create-debt.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Debts')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'debts', version: '1' })
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'ملخص الديون' })
  async summary(@Req() req: AuthenticatedRequest) {
    return this.debtsService.getSummary(req.tenantDb!);
  }

  // ─── Employee Debts ───
  @Get('employees')
  @ApiOperation({ summary: 'ديون الموظفات' })
  async getEmployeeDebts(@Req() req: AuthenticatedRequest) {
    return this.debtsService.getEmployeeDebts(req.tenantDb!);
  }

  @Post('employees')
  @ApiOperation({ summary: 'إضافة دين موظفة' })
  async createEmployeeDebt(@Req() req: AuthenticatedRequest, @Body() dto: CreateEmployeeDebtDto) {
    return this.debtsService.createEmployeeDebt(req.tenantDb!, dto);
  }

  @Patch('employees/:id/pay')
  @ApiOperation({ summary: 'تسديد دين موظفة' })
  async payEmployeeDebt(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.markEmployeeDebtPaid(req.tenantDb!, id);
  }

  @Delete('employees/:id')
  @ApiOperation({ summary: 'حذف دين موظفة' })
  async deleteEmployeeDebt(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.deleteEmployeeDebt(req.tenantDb!, id);
  }

  // ─── Client Debts ───
  @Get('clients')
  @ApiOperation({ summary: 'ديون العملاء' })
  async getClientDebts(@Req() req: AuthenticatedRequest) {
    return this.debtsService.getClientDebts(req.tenantDb!);
  }

  @Post('clients')
  @ApiOperation({ summary: 'إضافة دين عميل' })
  async createClientDebt(@Req() req: AuthenticatedRequest, @Body() dto: CreateClientDebtDto) {
    return this.debtsService.createClientDebt(req.tenantDb!, dto);
  }

  @Patch('clients/:id/pay')
  @ApiOperation({ summary: 'تسديد دين عميل' })
  async payClientDebt(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.markClientDebtPaid(req.tenantDb!, id);
  }

  @Delete('clients/:id')
  @ApiOperation({ summary: 'حذف دين عميل' })
  async deleteClientDebt(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.deleteClientDebt(req.tenantDb!, id);
  }
}
