import { IsNumber, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkServiceProductDto {
  @ApiProperty({ description: 'Product id' })
  @IsUUID('4', { message: 'productId must be a UUID' })
  productId: string;

  @ApiProperty({ description: 'Quantity consumed per service use' })
  @IsNumber()
  @Min(0)
  quantityPerUse: number;
}
