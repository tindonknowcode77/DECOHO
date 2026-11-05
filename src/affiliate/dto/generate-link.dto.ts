import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl } from 'class-validator';

export class GenerateLinkDto {
  @ApiProperty({
    description: 'Đường dẫn sản phẩm hoặc trang Shopee gốc',
    example: 'https://shopee.vn/product/12345/67890',
  })
  @IsNotEmpty({ message: 'URL gốc không được để trống' })
  @IsUrl(
    { require_protocol: true },
    { message: 'URL không hợp lệ. Vui lòng nhập link đầy đủ bao gồm http:// hoặc https://' },
  )
  originalUrl: string;
}

