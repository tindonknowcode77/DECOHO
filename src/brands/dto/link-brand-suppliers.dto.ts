import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsMongoId } from 'class-validator';

export class LinkBrandSuppliersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  supplierIds: string[];
}
