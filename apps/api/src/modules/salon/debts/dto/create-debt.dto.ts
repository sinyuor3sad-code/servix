import { IsString, IsNumber, IsOptional, IsUUID, Min, MinLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmployeeDebtDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'سلفة شهر أبريل' })
  @IsString()
  @MinLength(2)
  description: string;

  @ApiProperty({ example: 'advance' })
  @IsOptional()
  @IsIn(['advance', 'loan', 'other'])
  type?: string;

  @ApiProperty({ example: '2026-04-05' })
  @IsString()
  date: string;
}

export class CreateClientDebtDto {
  @ApiProperty()
  @IsUUID()
  clientId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiProperty({ example: 300 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'خدمات بالدين' })
  @IsString()
  @MinLength(2)
  description: string;

  @ApiProperty({ example: '2026-04-05' })
  @IsString()
  date: string;
}
