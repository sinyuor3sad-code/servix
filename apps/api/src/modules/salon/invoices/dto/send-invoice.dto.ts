import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

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
}
