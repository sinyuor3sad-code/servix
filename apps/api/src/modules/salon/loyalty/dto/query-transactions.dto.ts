import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export enum LoyaltyTransactionTypeEnum {
  earned = 'earned',
  redeemed = 'redeemed',
  expired = 'expired',
  adjusted = 'adjusted',
}

export class QueryTransactionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'تصفية بمعرّف العميل' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف العميل يجب أن يكون UUID صالحاً' })
  clientId?: string;

  @ApiPropertyOptional({ description: 'تصفية بنوع المعاملة', enum: LoyaltyTransactionTypeEnum })
  @IsOptional()
  @IsEnum(LoyaltyTransactionTypeEnum, { message: 'نوع المعاملة غير صالح' })
  type?: LoyaltyTransactionTypeEnum;
}
