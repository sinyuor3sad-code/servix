import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'رقم الصفحة يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'رقم الصفحة يجب أن يكون 1 على الأقل' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'عدد العناصر يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'عدد العناصر يجب أن يكون 1 على الأقل' })
  @Max(100, { message: 'عدد العناصر يجب ألا يتجاوز 100' })
  perPage: number = 20;

  /** Frontend sends 'limit' — alias for perPage */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value, obj }) => {
    if (value && !obj.perPage) obj.perPage = value;
    return value;
  })
  limit?: number;

  @IsOptional()
  @IsString({ message: 'حقل البحث يجب أن يكون نصاً' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'حقل الترتيب يجب أن يكون نصاً' })
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'اتجاه الترتيب يجب أن يكون تصاعدي أو تنازلي',
  })
  order: 'asc' | 'desc' = 'desc';
}
