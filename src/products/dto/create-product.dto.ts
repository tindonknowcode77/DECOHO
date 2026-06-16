import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
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

  @ApiProperty({ example: 'IKEA' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ecommercePlatform: string;

  @ApiProperty({ example: 'https://www.ikea.com/us/en/p/example-product' })
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  productLink: string;
}
