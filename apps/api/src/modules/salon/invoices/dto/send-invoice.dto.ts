import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export enum InvoiceSendChannel {
  whatsapp = 'whatsapp',
  email = 'email',
  sms = 'sms',
}

export class SendInvoiceDto {
  @ApiProperty({
    description: 'قناة الإرسال',
    enum: InvoiceSendChannel,
    example: 'whatsapp',
  })
  @IsNotEmpty({ message: 'قناة الإرسال مطلوبة' })
  @IsEnum(InvoiceSendChannel, { message: 'قناة الإرسال غير صالحة' })
  channel: InvoiceSendChannel;

  @ApiPropertyOptional({
    description:
      'رقم الواتساب البديل (E.164 بدون +). لو غير موجود يُستخدم رقم العميل المسجل في الفاتورة.',
    example: '966512345678',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{8,15}$/, { message: 'رقم الواتساب غير صالح' })
  to?: string;
}
