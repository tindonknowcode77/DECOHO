import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsMongoId, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Types } from 'mongoose';
import { MoodboardRoomType } from '../moodboard.schema';

export class AttachMoodboardProductDto {
  @ApiProperty({ example: '6687abc123abc123abc123ab' })
  @IsMongoId()
  productId: string;

  @ApiProperty({ example: 45, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  x: number;

  @ApiProperty({ example: 60, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  y: number;
}

export class UpdateMoodboardProductPointDto {
  @ApiProperty({ example: 45, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  x: number;

  @ApiProperty({ example: 60, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  y: number;
}

export class UpdateMoodboardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ enum: MoodboardRoomType })
  @IsOptional()
  @IsEnum(MoodboardRoomType)
  roomType?: MoodboardRoomType;
}

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
