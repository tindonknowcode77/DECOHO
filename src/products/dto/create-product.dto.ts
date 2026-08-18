import { ApiProperty } from '@nestjs/swagger';
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
} from 'class-validator';
import { Type } from 'class-transformer';
import { EcommercePlatform } from '../product.schema';

export class CreateProductDto {
  @ApiProperty({ required: false, description: 'Brand id' })
  @IsOptional()
  @IsMongoId()
  brandId?: string;

  @ApiProperty({ required: false, description: 'Category id' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiProperty({ example: 'Minimalist Wooden Desk' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 249.99 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 25, required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiProperty({
    example: 'https://res.cloudinary.com/decoho/image/upload/products/desk.jpg',
  })
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  image: string;

  @ApiProperty({
    example: ['minimalist', 'scandinavian', 'workspace'],
    maxItems: 20,
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  styleTags: string[];

  @ApiProperty({ example: 'desk' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category: string;

  @ApiProperty({
    enum: EcommercePlatform,
    example: EcommercePlatform.Shopee,
    description: 'Third-party ecommerce platform where the product is sold.',
  })
  @IsEnum(EcommercePlatform)
  ecommercePlatform: EcommercePlatform;

  @ApiProperty({
    example: 'https://shopee.vn/example-product-i.123456.789012',
    description: 'External product URL. FE can open this link directly.',
  })
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(1000)
  productLink: string;
}
