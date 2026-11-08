import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TrackClickDto {
  @ApiPropertyOptional({ description: 'ID của sản phẩm DECOHO' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Tên của sản phẩm' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ description: 'Link mua hàng Shopee' })
  @IsOptional()
  @IsString()
  productLink?: string;

  @ApiPropertyOptional({ description: 'Nguồn click (ví dụ: web_product_detail, web_pendant_lamp)' })
  @IsOptional()
  @IsString()
  source?: string;
}
