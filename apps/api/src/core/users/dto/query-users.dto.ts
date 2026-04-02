import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'بحث بالاسم أو البريد أو الجوال' })
  @IsOptional()
  @IsString({ message: 'نص البحث يجب أن يكون نصاً' })
  declare search?: string;

  @ApiPropertyOptional({
    description: 'حالة المستخدم',
    enum: ['active', 'inactive'],
  })
  @IsOptional()
  @IsIn(['active', 'inactive'], {
    message: 'حالة المستخدم يجب أن تكون نشط أو غير نشط',
  })
  status?: 'active' | 'inactive';
}
