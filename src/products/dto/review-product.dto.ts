import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ProductModerationAction {
  Approve = 'APPROVE',
  Reject = 'REJECT',
  Hide = 'HIDE',
  Lock = 'LOCK',
  Unlock = 'UNLOCK',
}

export class ReviewProductDto {
  @ApiProperty({ enum: ProductModerationAction })
  @IsEnum(ProductModerationAction)
  action: ProductModerationAction;

  @ApiPropertyOptional({ example: 'Hình ảnh không đúng với sản phẩm.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
