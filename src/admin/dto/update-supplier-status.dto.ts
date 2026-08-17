import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum SupplierStatusAction {
  Suspend = 'SUSPEND',
  Reactivate = 'REACTIVATE',
}

export class UpdateSupplierStatusDto {
  @ApiProperty({ enum: SupplierStatusAction })
  @IsEnum(SupplierStatusAction)
  action: SupplierStatusAction;

  @ApiPropertyOptional({ example: 'Vi phạm chính sách bán hàng.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
