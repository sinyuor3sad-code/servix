import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum GenderEnum {
  female = 'female',
  male = 'male',
}

export enum ClientSourceEnum {
  walk_in = 'walk_in',
  online = 'online',
  phone = 'phone',
  referral = 'referral',
}

export class CreateClientDto {
  @ApiProperty({ description: 'الاسم الكامل', example: 'نورة أحمد' })
  @IsString({ message: 'الاسم يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'الاسم الكامل مطلوب' })
  @MaxLength(100, { message: 'الاسم يجب ألا يتجاوز 100 حرف' })
  fullName: string;

  @ApiProperty({ description: 'رقم الجوال', example: '+966501234567' })
  @IsString({ message: 'رقم الجوال يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'رقم الجوال مطلوب' })
  @MaxLength(15, { message: 'رقم الجوال يجب ألا يتجاوز 15 رقماً' })
  phone: string;

  @ApiPropertyOptional({ description: 'البريد الإلكتروني', example: 'noura@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  @MaxLength(100, { message: 'البريد الإلكتروني يجب ألا يتجاوز 100 حرف' })
  email?: string;

  @ApiPropertyOptional({ description: 'الجنس', enum: GenderEnum, default: GenderEnum.female })
  @IsOptional()
  @IsEnum(GenderEnum, { message: 'الجنس يجب أن يكون أنثى أو ذكر' })
  gender?: GenderEnum;

  @ApiPropertyOptional({ description: 'تاريخ الميلاد', example: '1990-05-15' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ الميلاد يجب أن يكون تاريخاً صالحاً' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'ملاحظات', example: 'تفضل القص القصير' })
  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'مصدر العميل',
    enum: ClientSourceEnum,
    default: ClientSourceEnum.walk_in,
  })
  @IsOptional()
  @IsEnum(ClientSourceEnum, {
    message: 'مصدر العميل يجب أن يكون: حضور مباشر، أونلاين، هاتف، أو إحالة',
  })
  source?: ClientSourceEnum;
}
