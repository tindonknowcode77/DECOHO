import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsMongoId, IsNumber, IsString, Min } from 'class-validator';

export class ValidatePromotionDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) subtotal: number;
  @ApiProperty({ type: [String] }) @IsArray() @IsMongoId({ each: true }) productIds: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsMongoId({ each: true }) categoryIds: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsMongoId({ each: true }) supplierIds: string[];
}
