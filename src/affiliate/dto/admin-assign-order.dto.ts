import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminAssignOrderDto {
  @ApiProperty({
    description: 'Mã đơn hàng Shopee (Order ID)',
    example: '2604056P23R59R',
  })
  @IsNotEmpty({ message: 'Mã đơn hàng không được để trống' })
  @IsString()
  orderId: string;

  @ApiProperty({
    description: 'Email hoặc User ID của người dùng nhận đơn',
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: 'Vui lòng chọn hoặc nhập Email / ID người dùng' })
  @IsString()
  userIdentifier: string;
}
