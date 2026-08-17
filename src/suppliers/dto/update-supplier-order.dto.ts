import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '../../orders/order.schema';

export class UpdateSupplierOrderDto {
  @ApiProperty({ enum: [OrderStatus.Confirmed, OrderStatus.Processing, OrderStatus.Shipping, OrderStatus.Delivered] })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) trackingCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) shippingProvider?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}
