import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ShowroomDesignItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  instanceId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  productId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  modelUrl: string;

  @ApiProperty({ type: [Number], example: [0, 0.055, 0] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber({}, { each: true })
  position: number[];

  @ApiProperty()
  @IsNumber()
  rotationY: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  scale: number;
}

export class SaveShowroomDesignDto {
  @ApiProperty({ example: 'Phòng ngủ tối giản của tôi' })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 'minimal-living-room' })
  @IsString()
  @MaxLength(120)
  showroomId: string;

  @ApiPropertyOptional({ example: 'Phòng Ngủ Tối Giản Bắc Âu' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  showroomName?: string;

  @ApiProperty({ type: [ShowroomDesignItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShowroomDesignItemDto)
  items: ShowroomDesignItemDto[];
}

export class UpdateShowroomDesignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  showroomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  showroomName?: string;

  @ApiPropertyOptional({ type: [ShowroomDesignItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShowroomDesignItemDto)
  items?: ShowroomDesignItemDto[];
}
