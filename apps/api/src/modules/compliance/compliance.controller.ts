import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../shared/decorators/public.decorator';
import { RateLimit } from '../../shared/guards/rate-limit.guard';
import { ComplianceService } from './compliance.service';
import { SubmitComplaintDto } from './dto/submit-complaint.dto';
import { COMPLAINT_TYPES_AR } from './compliance.constants';

@ApiTags('Compliance — Public legal info & complaints')
@Controller('compliance')
@Public()
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('legal-info')
  @ApiOperation({ summary: 'بيانات المنشأة والقنوات الرسمية للموقع' })
  @ApiResponse({ status: 200, description: 'القيم غير المعدّة تعود فارغة — على الواجهة إخفاؤها لا اختلاقها' })
  async getLegalInfo() {
    return this.compliance.getPublicLegalInfo();
  }

  @Get('complaint-types')
  @ApiOperation({ summary: 'قائمة أنواع الشكاوى المتاحة' })
  async getComplaintTypes() {
    return { types: [...COMPLAINT_TYPES_AR] };
  }

  @Post('complaints')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(5, 600) // 5 complaints / 10 minutes per IP — anti-spam
  @ApiOperation({ summary: 'تقديم شكوى — يعيد رقمًا مرجعيًا ووقت الرد المتوقع' })
  @ApiResponse({ status: 201, description: 'تم تسجيل الشكوى' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 429, description: 'تم تجاوز الحد المسموح، حاول لاحقًا' })
  async submitComplaint(
    @Body() dto: SubmitComplaintDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.compliance.submitComplaint(dto, {
      ipAddress: ip ?? null,
      userAgent: userAgent ?? null,
    });
  }
}
