import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'اسم الدور بالإنجليزية (فريد)',
    example: 'branch_manager',
  })
  @IsString({ message: 'اسم الدور يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم الدور مطلوب' })
  @MaxLength(50, { message: 'اسم الدور يجب ألا يتجاوز 50 حرف' })
  name: string;

  @ApiProperty({
    description: 'اسم الدور بالعربية',
    example: 'مدير الفرع',
  })
  @IsString({ message: 'اسم الدور بالعربية يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم الدور بالعربية مطلوب' })
  @MaxLength(50, { message: 'اسم الدور بالعربية يجب ألا يتجاوز 50 حرف' })
  nameAr: string;
}
