import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupplierPayoutStatus } from '../payment.schema';

export class UpdatePayoutDto {
  @ApiProperty({ enum: [SupplierPayoutStatus.Paid, SupplierPayoutStatus.Held] })
  @IsEnum(SupplierPayoutStatus) status: SupplierPayoutStatus.Paid | SupplierPayoutStatus.Held;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
