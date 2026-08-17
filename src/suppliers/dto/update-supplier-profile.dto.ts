import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateSupplierProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) storeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1200) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(254) contactEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) businessAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(500) website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) taxCode?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(120, { each: true }) shippingAreas?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) warrantyPolicy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) returnPolicy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) bankAccountNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) bankAccountName?: string;
}
