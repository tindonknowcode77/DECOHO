import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, Min } from 'class-validator';
import { RoomType } from '../room.schema';

export class CreateRoomDto {
  @ApiProperty({ enum: RoomType, example: RoomType.LivingRoom })
  @IsEnum(RoomType)
  roomType: RoomType;

  @ApiProperty({ example: 4.5 })
  @Transform(({ value }) => Number(value)) @IsNumber() @Min(0.1)
  width: number;

  @ApiProperty({ example: 6.2 })
  @Transform(({ value }) => Number(value)) @IsNumber() @Min(0.1)
  length: number;
}
