import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SubmitComplaintDto {
  @IsString()
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'رقم الجوال مطلوب' })
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsString()
  @IsNotEmpty({ message: 'نوع الشكوى مطلوب' })
  @MaxLength(80)
  complaintType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  orderOrInvoiceNumber?: string;

  @IsString()
  @IsNotEmpty({ message: 'وصف المشكلة مطلوب' })
  @MinLength(10, { message: 'الرجاء كتابة 10 أحرف على الأقل' })
  @MaxLength(4000)
  message!: string;
}
