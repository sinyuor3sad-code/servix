import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';
import { AIAnalyticsService, WeeklyStats } from './ai-analytics.service';

/**
 * Read-only endpoints exposed to the salon dashboard. Mutations on AI
 * reception still go through the generic settings controller — this lives
 * separately because the analytics aggregation has no settings counterpart.
 */
@ApiTags('AI Reception')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'salon/ai-reception', version: '1' })
export class AIReceptionController {
  constructor(private readonly analytics: AIAnalyticsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'إحصائيات الاستقبال الذكي للأسبوع الحالي' })
  @ApiResponse({ status: 200, description: 'إرجاع الإحصائيات بنجاح' })
  async getWeeklyStats(@Req() req: AuthenticatedRequest): Promise<WeeklyStats> {
    return this.analytics.getWeeklyStats(req.tenant!.id);
  }
}
