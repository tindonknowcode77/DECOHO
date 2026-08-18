import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OrderReasonDto { @ApiProperty() @IsString() @MaxLength(1000) reason: string; }
export class RefundOrderDto extends OrderReasonDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) amount?: number;
}
export class ResolveComplaintDto { @ApiProperty() @IsString() @MaxLength(2000) resolution: string; }
