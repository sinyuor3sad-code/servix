import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({ description: 'اسم الصالون للتأكيد' })
  @IsString()
  @IsNotEmpty({ message: 'يرجى إدخال اسم الصالون للتأكيد' })
  salonNameConfirm: string;

  @ApiProperty({ description: 'كلمة المرور' })
  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @MinLength(6, { message: 'كلمة المرور غير صحيحة' })
  password: string;
}
