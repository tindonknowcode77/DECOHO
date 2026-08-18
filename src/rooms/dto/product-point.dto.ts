import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId, IsNumber, Max, Min } from 'class-validator';

export class ProductPointDto {
  @ApiProperty({ example: '6687abc123abc123abc123ab' })
  @IsMongoId()
  productId: string;

  @ApiProperty({ example: 45, minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  x: number;

  @ApiProperty({ example: 60, minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  y: number;
}
