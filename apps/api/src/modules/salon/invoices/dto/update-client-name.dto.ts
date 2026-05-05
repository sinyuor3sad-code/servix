import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateInvoiceClientNameDto {
  @ApiProperty({ description: 'الاسم الجديد للعميل', example: 'نورة العتيبي', minLength: 2, maxLength: 100 })
  @IsString({ message: 'الاسم يجب أن يكون نصاً' })
  @MinLength(2, { message: 'الاسم يجب ألا يقل عن حرفين' })
  @MaxLength(100, { message: 'الاسم يجب ألا يتجاوز 100 حرف' })
  fullName!: string;
}
