import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEmail, IsInt, IsMongoId, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

class CreateOrderItemDto {
  @ApiProperty() @IsMongoId() productId: string;
  @ApiProperty({ minimum: 1 }) @Type(() => Number) @IsInt() @Min(1) quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto) items: CreateOrderItemDto[];
  @ApiProperty() @IsString() @MaxLength(120) customerName: string;
  @ApiProperty() @IsEmail() customerEmail: string;
  @ApiProperty() @IsString() @MaxLength(20) customerPhone: string;
  @ApiProperty() @IsString() @MaxLength(500) shippingAddress: string;
  @ApiPropertyOptional({ default: 'COD' }) @IsOptional() @IsString() @MaxLength(50) paymentMethod?: string;
  @ApiPropertyOptional({ example: 'DECOHO20' }) @IsOptional() @IsString() @MaxLength(30) promotionCode?: string;
}
