import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LinkGoogleDto {
  @ApiProperty({ description: 'Google ID token من Google Sign-In في الفرونت' })
  @IsNotEmpty({ message: 'رمز Google مطلوب' })
  @IsString({ message: 'رمز Google يجب أن يكون نصاً' })
  idToken: string;
}
