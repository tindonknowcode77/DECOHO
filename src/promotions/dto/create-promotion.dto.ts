import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsDate, IsEnum, IsInt, IsMongoId, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { DiscountType } from '../promotion.schema';

export class CreatePromotionDto {
  @ApiProperty({ example: 'DECOHO20' }) @IsString() @Matches(/^[A-Za-z0-9_-]{3,30}$/) code: string;
  @ApiProperty({ enum: DiscountType }) @IsEnum(DiscountType) discountType: DiscountType;
  @ApiProperty({ example: 20 }) @Type(() => Number) @IsNumber() @Min(0) discountValue: number;
  @ApiProperty() @Type(() => Date) @IsDate() startDate: Date;
  @ApiProperty() @Type(() => Date) @IsDate() endDate: Date;
  @ApiProperty({ example: 100 }) @Type(() => Number) @IsInt() @Min(1) usageLimit: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minimumOrderAmount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maximumDiscountAmount?: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayUnique() @IsMongoId({ each: true }) productIds?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayUnique() @IsMongoId({ each: true }) categoryIds?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayUnique() @IsMongoId({ each: true }) supplierIds?: string[];
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
}
