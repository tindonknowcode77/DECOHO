import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class RefundPaymentDto {
  @ApiProperty({ minimum: 1 }) @Type(() => Number) @IsNumber() @Min(1) amount: number;
  @ApiProperty() @IsString() @MaxLength(1000) reason: string;
}
