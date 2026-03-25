import {
  Controller,
  Get,
  Post,
  Patch,
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
  ApiParam,
} from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { QueryShiftsDto } from './dto/query-shifts.dto';
import { GenerateShiftsDto } from './dto/generate-shifts.dto';
import { TenantGuard } from '@shared/guards';
import { AuthenticatedRequest } from '@shared/types';

@ApiTags('Shifts')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'shifts', version: '1' })
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @ApiOperation({ summary: 'List shifts for a date' })
  @ApiResponse({ status: 200, description: 'Shifts for the given date' })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryShiftsDto,
  ) {
    const data = await this.shiftsService.listForDate(req.tenantDb!, query.date);
    return {
      success: true,
      data,
      message: 'Shifts loaded',
    };
  }

  @Post('generate-week')
  @ApiOperation({ summary: 'Generate shifts from schedules for next 7 days' })
  @ApiResponse({ status: 201, description: 'Generation result' })
  async generateWeek(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GenerateShiftsDto,
  ) {
    const data = await this.shiftsService.generateWeekFromSchedules(req.tenantDb!, dto);
    return {
      success: true,
      data,
      message: 'Shifts generated',
    };
  }

  @Patch(':id/check-in')
  @ApiOperation({ summary: 'Employee check-in' })
  @ApiParam({ name: 'id', description: 'Shift id' })
  @ApiResponse({ status: 200, description: 'Check-in recorded' })
  async checkIn(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.shiftsService.checkIn(req.tenantDb!, id);
    return {
      success: true,
      data,
      message: 'Checked in',
    };
  }

  @Patch(':id/check-out')
  @ApiOperation({ summary: 'Employee check-out' })
  @ApiParam({ name: 'id', description: 'Shift id' })
  @ApiResponse({ status: 200, description: 'Check-out recorded' })
  async checkOut(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.shiftsService.checkOut(req.tenantDb!, id);
    return {
      success: true,
      data,
      message: 'Checked out',
    };
  }
}
