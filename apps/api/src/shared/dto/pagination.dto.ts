import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsOptional()
  @IsString({ message: 'حقل الترتيب يجب أن يكون نصاً' })
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'اتجاه الترتيب يجب أن يكون تصاعدي أو تنازلي',
  })
  order: 'asc' | 'desc' = 'desc';
}
