import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RoomType } from '../room.schema';

export class CreateRoomDto {
  @ApiProperty({ enum: RoomType, example: RoomType.LivingRoom })
  @IsEnum(RoomType)
  roomType: RoomType;

  @ApiProperty({ example: 4.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  width: number;

  @ApiProperty({ example: 6.2 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  length: number;
}
