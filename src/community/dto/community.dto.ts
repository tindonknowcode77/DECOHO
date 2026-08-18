import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
export class CreateCommunityPostDto {
  @IsString() @MaxLength(3000) description: string;
  @IsString() @MaxLength(60) roomType: string;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.split(',').map((item:string)=>item.trim()).filter(Boolean) : value) @IsArray() @IsString({ each: true }) hashtags?: string[];
}
export class CreateCommunityCommentDto { @IsString() @MaxLength(1000) content: string; }
