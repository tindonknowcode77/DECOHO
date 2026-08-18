import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) trackingCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) shippingProvider?: string;
}
