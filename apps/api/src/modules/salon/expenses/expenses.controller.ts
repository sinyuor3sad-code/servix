import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'expenses', version: '1' })
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'عرض جميع المصروفات' })
  @ApiResponse({ status: 200, description: 'تم جلب المصروفات بنجاح' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryExpensesDto,
  ) {
    return this.expensesService.findAll(
      req.tenantDb!,
      query,
    );
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء مصروف جديد' })
  @ApiResponse({ status: 201, description: 'تم إنشاء المصروف بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateExpenseDto,
  ): Promise<Record<string, unknown>> {
    return this.expensesService.create(
      req.tenantDb!,
      dto,
      req.user.sub,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'عرض تفاصيل مصروف' })
  @ApiResponse({ status: 200, description: 'تم جلب تفاصيل المصروف بنجاح' })
  @ApiResponse({ status: 404, description: 'المصروف غير موجود' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    return this.expensesService.findOne(
      req.tenantDb!,
      id,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث مصروف' })
  @ApiResponse({ status: 200, description: 'تم تحديث المصروف بنجاح' })
  @ApiResponse({ status: 404, description: 'المصروف غير موجود' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<Record<string, unknown>> {
    return this.expensesService.update(
      req.tenantDb!,
      id,
      dto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف مصروف' })
  @ApiResponse({ status: 200, description: 'تم حذف المصروف بنجاح' })
  @ApiResponse({ status: 404, description: 'المصروف غير موجود' })
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    return this.expensesService.remove(
      req.tenantDb!,
      id,
    );
  }
}
