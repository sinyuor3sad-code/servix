import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';
import { GenderEnum, ClientSourceEnum } from './create-client.dto';

export class QueryClientsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'بحث بالاسم أو رقم الجوال' })
  @IsOptional()
  @IsString({ message: 'نص البحث يجب أن يكون نصاً' })
  search?: string;

  @ApiPropertyOptional({ description: 'تصفية بالجنس', enum: GenderEnum })
  @IsOptional()
  @IsEnum(GenderEnum, { message: 'الجنس يجب أن يكون أنثى أو ذكر' })
  gender?: GenderEnum;

  @ApiPropertyOptional({ description: 'تصفية بمصدر العميل', enum: ClientSourceEnum })
  @IsOptional()
  @IsEnum(ClientSourceEnum, { message: 'مصدر العميل غير صالح' })
  source?: ClientSourceEnum;

  @ApiPropertyOptional({ description: 'تصفية بحالة النشاط', example: true })
  @IsOptional()
  @IsBoolean({ message: 'حالة النشاط يجب أن تكون صحيحة أو خاطئة' })
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}
