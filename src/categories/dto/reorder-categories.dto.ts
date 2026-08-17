import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsMongoId, Min, ValidateNested } from 'class-validator';

class CategoryOrderDto {
  @ApiProperty()
  @IsMongoId()
  id: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({ type: [CategoryOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryOrderDto)
  items: CategoryOrderDto[];
}
