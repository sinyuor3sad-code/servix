import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingDto {
  @ApiProperty({ description: 'قيمة الإعداد' })
  @IsString({ message: 'قيمة الإعداد يجب أن تكون نصاً' })
  value: string;
}
