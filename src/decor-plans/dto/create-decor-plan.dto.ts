import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DecorStyle } from '../decor-plan.schema';

export class CreateDecorPlanDto {
  @ApiProperty({ example: '666f8b1c8a7f5e0012a22201' })
  @IsMongoId()
  roomId: string;

  @ApiProperty({ example: 5000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget: number;

  @ApiProperty({ enum: DecorStyle, example: DecorStyle.Minimalist })
  @IsEnum(DecorStyle)
  style: DecorStyle;
}
