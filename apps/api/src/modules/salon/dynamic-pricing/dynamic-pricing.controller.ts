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
import { DynamicPricingService } from './dynamic-pricing.service';
import {
  CreatePricingRuleDto,
  UpdatePricingRuleDto,
  CalculatePriceQueryDto,
} from './dto/create-rule.dto';
import { TenantGuard } from '@shared/guards';
import { AuthenticatedRequest } from '@shared/types';

@ApiTags('Dynamic pricing')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'pricing', version: '1' })
export class DynamicPricingController {
  constructor(private readonly dynamicPricingService: DynamicPricingService) {}

  @Get('rules')
  @ApiOperation({ summary: 'List pricing rules' })
  @ApiResponse({ status: 200 })
  async list(@Req() req: AuthenticatedRequest) {
    const data = await this.dynamicPricingService.listRules(req.tenantDb!);
    return { success: true, data, message: 'Pricing rules' };
  }

  @Post('rules')
  @ApiOperation({ summary: 'Create pricing rule' })
  @ApiResponse({ status: 201 })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreatePricingRuleDto) {
    const data = await this.dynamicPricingService.createRule(req.tenantDb!, dto);
    return { success: true, data, message: 'Rule created' };
  }

  @Get('calculate')
  @ApiOperation({ summary: 'Calculate effective price' })
  @ApiResponse({ status: 200 })
  async calculate(
    @Req() req: AuthenticatedRequest,
    @Query() query: CalculatePriceQueryDto,
  ) {
    const data = await this.dynamicPricingService.calculateEffectivePrice(
      req.tenantDb!,
      query.serviceId,
      query.date,
      query.time,
    );
    return { success: true, data, message: 'Calculated price' };
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update pricing rule' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePricingRuleDto,
  ) {
    const data = await this.dynamicPricingService.updateRule(req.tenantDb!, id, dto);
    return { success: true, data, message: 'Rule updated' };
  }
}
