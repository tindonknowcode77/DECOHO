import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  IsOptional,
  IsInt,
  IsMongoId,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EcommercePlatform } from '../product.schema';

class DimensionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  length?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  width?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  height?: string;
}

export class CreateProductDto {
  @ApiPropertyOptional({ description: 'Brand id' })
  @IsOptional()
  @IsMongoId()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Category id' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'SKU-001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @ApiProperty({ example: 'Minimalist Wooden Desk' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ example: 'Bàn' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ example: 'DECOHO' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @ApiPropertyOptional({ example: 'Bàn làm việc tối giản, chân sắt sơn tĩnh điện, mặt gỗ oak tự nhiên.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 2490000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 15, required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ example: 25, required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/decoho/image/upload/products/desk.jpg',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  image?: string;

  @ApiPropertyOptional({ example: ['minimalist', 'scandinavian', 'workspace'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  styleTags?: string[];

  @ApiPropertyOptional({ example: ['minimalist', 'scandinavian', 'workspace'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'Gỗ sồi, sắt sơn tĩnh điện' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  material?: string;

  @ApiPropertyOptional({ example: 'Nâu vàng tự nhiên' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string;

  @ApiPropertyOptional({ example: { length: '120', width: '60', height: '75' } })
  @IsOptional()
  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions?: DimensionsDto;

  @ApiPropertyOptional({ example: '15 kg' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  weight?: string;

  @ApiPropertyOptional({ example: 'Việt Nam' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  origin?: string;

  @ApiPropertyOptional({ example: '12 tháng' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  warranty?: string;

  @ApiPropertyOptional({ example: 4.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rating?: number;

  @ApiPropertyOptional({ example: 128 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reviews?: number;

  @ApiPropertyOptional({ example: ['img1.jpg', 'img2.jpg'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    enum: EcommercePlatform,
    example: EcommercePlatform.Shopee,
    description: 'Third-party ecommerce platform where the product is sold.',
  })
  @IsOptional()
  @IsEnum(EcommercePlatform)
  ecommercePlatform?: EcommercePlatform;

  @ApiPropertyOptional({
    example: 'https://shopee.vn/example-product-i.123456.789012',
    description: 'External product URL.',
  })
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(1000)
  productLink?: string;
}
