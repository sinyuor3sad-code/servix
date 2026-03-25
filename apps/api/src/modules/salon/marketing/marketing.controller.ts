import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
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
import { MarketingService } from './marketing.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/create-campaign.dto';
import { TenantGuard } from '@shared/guards';
import { AuthenticatedRequest } from '@shared/types';

@ApiTags('Marketing')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'marketing', version: '1' })
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('campaigns')
  @ApiOperation({ summary: 'List campaigns' })
  @ApiResponse({ status: 200 })
  async listCampaigns(@Req() req: AuthenticatedRequest) {
    const data = await this.marketingService.listCampaigns(req.tenantDb!);
    return { success: true, data, message: 'Campaigns' };
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create campaign' })
  @ApiResponse({ status: 201 })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCampaignDto,
  ) {
    const data = await this.marketingService.createCampaign(req.tenantDb!, dto);
    return { success: true, data, message: 'Campaign created' };
  }

  @Get('gaps')
  @ApiOperation({ summary: 'Detect calendar gaps (empty bookable slots)' })
  @ApiResponse({ status: 200 })
  async gaps(@Req() req: AuthenticatedRequest) {
    const data = await this.marketingService.detectCalendarGaps(req.tenantDb!);
    return { success: true, data, message: 'Calendar gaps' };
  }

  @Patch('campaigns/:id')
  @ApiOperation({ summary: 'Update campaign' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const data = await this.marketingService.updateCampaign(req.tenantDb!, id, dto);
    return { success: true, data, message: 'Campaign updated' };
  }

  @Post('campaigns/:id/execute')
  @ApiOperation({ summary: 'Execute campaign' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  async execute(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.marketingService.executeCampaign(req.tenantDb!, id);
    return { success: true, data, message: 'Campaign executed' };
  }
}
