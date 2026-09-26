import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MoodboardRoomType } from '../moodboard.schema';

export class MoodboardProductPointInput {
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

export class CreateMoodboardDto {
  @ApiProperty({ enum: MoodboardRoomType, example: MoodboardRoomType.LivingRoom })
  @IsEnum(MoodboardRoomType)
  roomType: MoodboardRoomType;

  @ApiPropertyOptional({ example: 'Phòng khách Japandi' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ example: 'Phong cách tối giản với tông gỗ ấm áp' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['Japandi', 'Minimal'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  isPublic?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  isFeatured?: boolean;

  /**
   * Có thể ghim sản phẩm ngay khi tạo moodboard.
   * Nếu không truyền thì moodboard sẽ rỗng, admin ghim sau bằng POST /admin/:id/products.
   */
  @ApiPropertyOptional({ type: [MoodboardProductPointInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MoodboardProductPointInput)
  productPoints?: MoodboardProductPointInput[];
}
