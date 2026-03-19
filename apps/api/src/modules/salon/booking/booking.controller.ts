import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SlotsQueryDto } from './dto/slots-query.dto';
import { Public } from '../../../shared/decorators';

@ApiTags('Booking (Public)')
@Public()
@Controller({ path: 'booking', version: '1' })
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'عرض معلومات الصالون العامة' })
  @ApiResponse({ status: 200, description: 'تم جلب معلومات الصالون بنجاح' })
  @ApiResponse({ status: 404, description: 'الصالون غير موجود' })
  async getSalonInfo(
    @Param('slug') slug: string,
  ): Promise<Record<string, unknown>> {
    return this.bookingService.getSalonInfo(slug);
  }

  @Get(':slug/services')
  @ApiOperation({ summary: 'عرض خدمات الصالون المتاحة' })
  @ApiResponse({ status: 200, description: 'تم جلب الخدمات بنجاح' })
  async getServices(
    @Param('slug') slug: string,
  ): Promise<Record<string, unknown>[]> {
    return this.bookingService.getServices(slug);
  }

  @Get(':slug/employees')
  @ApiOperation({ summary: 'عرض موظفي الصالون المتاحين' })
  @ApiResponse({ status: 200, description: 'تم جلب الموظفين بنجاح' })
  async getEmployees(
    @Param('slug') slug: string,
  ): Promise<Record<string, unknown>[]> {
    return this.bookingService.getEmployees(slug);
  }

  @Get(':slug/slots')
  @ApiOperation({ summary: 'عرض المواعيد المتاحة' })
  @ApiResponse({ status: 200, description: 'تم جلب المواعيد المتاحة بنجاح' })
  async getAvailableSlots(
    @Param('slug') slug: string,
    @Query() query: SlotsQueryDto,
  ): Promise<string[]> {
    return this.bookingService.getAvailableSlots(slug, query);
  }

  @Post(':slug/send-otp')
  @ApiOperation({ summary: 'إرسال رمز تحقق OTP للحجز' })
  @ApiResponse({ status: 200, description: 'تم إرسال رمز التحقق' })
  @ApiResponse({ status: 400, description: 'خطأ في الإرسال' })
  async sendOtp(
    @Body() body: { phone: string },
  ): Promise<Record<string, unknown>> {
    const result = await this.bookingService.sendOtp(body.phone);
    return { success: true, data: result, message: result.message };
  }

  @Post(':slug/verify-otp')
  @ApiOperation({ summary: 'التحقق من رمز OTP' })
  @ApiResponse({ status: 200, description: 'نتيجة التحقق' })
  async verifyOtp(
    @Body() body: { phone: string; code: string },
  ): Promise<Record<string, unknown>> {
    const result = await this.bookingService.verifyOtp(body.phone, body.code);
    return { success: true, data: result };
  }

  @Post(':slug/book')
  @ApiOperation({ summary: 'حجز موعد جديد' })
  @ApiResponse({ status: 201, description: 'تم الحجز بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 404, description: 'الصالون غير موجود' })
  async createBooking(
    @Param('slug') slug: string,
    @Body() dto: CreateBookingDto,
  ): Promise<Record<string, unknown>> {
    return this.bookingService.createBooking(slug, dto);
  }
}
