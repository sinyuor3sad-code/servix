import { Controller, Get, Patch, Query, Param, Body, Req, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Feedback')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'salon/feedback', version: '1' })
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /* ── List all feedbacks (paginated + filtered) ── */
  @Get()
  @ApiOperation({ summary: 'قائمة التقييمات' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'minRating', required: false, type: Number })
  @ApiQuery({ name: 'maxRating', required: false, type: Number })
  @ApiQuery({ name: 'followUpStatus', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('minRating') minRating?: string,
    @Query('maxRating') maxRating?: string,
    @Query('followUpStatus') followUpStatus?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.feedbackService.findAll(req.tenantDb!, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      minRating: minRating ? +minRating : undefined,
      maxRating: maxRating ? +maxRating : undefined,
      followUpStatus: followUpStatus || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }

  /* ── Summary stats ── */
  @Get('summary')
  @ApiOperation({ summary: 'إحصائيات التقييمات' })
  async getSummary(@Req() req: AuthenticatedRequest) {
    return this.feedbackService.getSummary(req.tenantDb!);
  }

  /* ── Update follow-up status ── */
  @Patch(':id/status')
  @ApiOperation({ summary: 'تحديث حالة المتابعة' })
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ) {
    return this.feedbackService.updateFollowUp(req.tenantDb!, id, status);
  }
}
