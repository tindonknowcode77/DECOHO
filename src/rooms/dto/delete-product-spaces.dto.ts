import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteProductSpacesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(128, { each: true })
  ids: string[];
}
