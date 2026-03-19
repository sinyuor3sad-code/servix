import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty({ description: 'معرف الموظف' })
  @IsUUID('4', { message: 'معرف الموظف يجب أن يكون UUID صالح' })
  employeeId: string;
}
