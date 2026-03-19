import { IsOptional, IsUUID, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class QueryAuditLogDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'معرف المنشأة', format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'معرف المنشأة يجب أن يكون UUID صالح' })
  tenantId?: string;

  @ApiPropertyOptional({ description: 'معرف المستخدم', format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'معرف المستخدم يجب أن يكون UUID صالح' })
  userId?: string;

  @ApiPropertyOptional({ description: 'الإجراء المنفذ', example: 'create' })
  @IsOptional()
  @IsString({ message: 'الإجراء يجب أن يكون نصاً' })
  action?: string;

  @ApiPropertyOptional({ description: 'نوع الكيان', example: 'tenant' })
  @IsOptional()
  @IsString({ message: 'نوع الكيان يجب أن يكون نصاً' })
  entityType?: string;

  @ApiPropertyOptional({ description: 'تاريخ البداية', example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ البداية يجب أن يكون تاريخاً صالحاً' })
  @Type(() => Date)
  dateFrom?: Date;

  @ApiPropertyOptional({ description: 'تاريخ النهاية', example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ النهاية يجب أن يكون تاريخاً صالحاً' })
  @Type(() => Date)
  dateTo?: Date;
}
