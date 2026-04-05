import { IsString, IsOptional, IsNumber, IsArray, Min, MinLength, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePackageDto {
  @ApiProperty({ example: 'باقة العروس' })
  @IsString()
  @MinLength(2)
  nameAr: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiProperty({ example: ['{uuid}', '{uuid}'] })
  @IsArray()
  @ArrayMinSize(2, { message: 'الباقة تحتاج خدمتين على الأقل' })
  @IsString({ each: true })
  serviceIds: string[];

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(1)
  packagePrice: number;
}
