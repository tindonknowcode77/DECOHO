import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ClaimOrderDto {
  @ApiProperty({
    description: 'Mã đơn hàng Shopee từ thông tin đơn hàng của người dùng',
    example: '241105ABCD1234',
  })
  @IsNotEmpty({ message: 'Mã đơn hàng (Order ID) không được để trống' })
  @IsString({ message: 'Mã đơn hàng phải là chuỗi ký tự' })
  @Length(5, 60, { message: 'Mã đơn hàng phải từ 5 đến 60 ký tự' })
  orderId: string;
}

