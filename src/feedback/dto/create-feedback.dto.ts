import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FeedbackType } from '../feedback.schema';

export class FeedbackMediaDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  url: string;

  @IsNotEmpty()
  @IsIn(['image', 'video'])
  type: 'image' | 'video';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  publicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  thumbnailUrl?: string;
}

export class CreateFeedbackDto {
  @IsOptional()
  @IsEnum(FeedbackType)
  type?: FeedbackType;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FeedbackMediaDto)
  media?: FeedbackMediaDto[];

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  userName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  userEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageUrl?: string;
}
