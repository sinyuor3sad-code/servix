import {
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OpenShiftDto {
  @ApiProperty({ description: 'مبلغ البداية في الصندوق', minimum: 0 })
  @IsNumber({}, { message: 'مبلغ البداية يجب أن يكون رقماً' })
  @Min(0, { message: 'مبلغ البداية يجب أن يكون 0 على الأقل' })
  openingBalance: number;
}
