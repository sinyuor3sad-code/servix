import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AiConsultantService } from './ai-consultant.service';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('المستشار الذكي - AI Consultant')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'salon/ai-consultant', version: '1' })
export class AiConsultantController {
  constructor(private readonly consultantService: AiConsultantService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'اسأل المستشار الذكي',
    description: 'اسأل المستشار الذكي سؤالاً عن صالونك — يجاوب بناءً على بيانات صالونك الفعلية',
  })
  @ApiResponse({ status: 200, description: 'تم الحصول على إجابة المستشار' })
  @ApiResponse({ status: 401, description: 'غير مصرح' })
  async ask(
    @Req() req: AuthenticatedRequest,
    @Body() body: { question: string },
  ): Promise<Record<string, unknown>> {
    if (!body.question || body.question.trim().length === 0) {
      throw new BadRequestException('يرجى كتابة سؤال');
    }

    const tenantId = req.user?.tenantId || req.tenant?.id || '';
    const databaseName = req.tenant?.databaseName || '';

    const answer = await this.consultantService.ask(
      tenantId,
      databaseName,
      body.question.trim(),
    );

    return {
      success: true,
      data: { answer },
      message: 'تم الحصول على إجابة المستشار الذكي',
    };
  }
}
