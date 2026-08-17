import { Type } from 'class-transformer';
import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { ShowroomStatus } from '../showroom.schema';

export class Vector3Dto{ @Type(()=>Number) @IsNumber() x:number; @Type(()=>Number) @IsNumber() y:number; @Type(()=>Number) @IsNumber() z:number; }
export class CreateShowroomDto{ @IsString() @MaxLength(160) title:string; @IsOptional() @IsString() @MaxLength(1000) description?:string; @IsOptional() @IsUrl() thumbnailUrl?:string; }
export class UpdateShowroomDto{ @IsOptional() @IsString() @MaxLength(160) title?:string; @IsOptional() @IsString() @MaxLength(1000) description?:string; @IsOptional() @IsUrl() thumbnailUrl?:string; @IsOptional() @IsEnum(ShowroomStatus) status?:ShowroomStatus; }
export class AddShowroomItemDto{
  @IsMongoId() productId:string;
  @IsUrl() modelUrl:string;
  @IsOptional() @IsString() modelPublicId?:string;
  @ValidateNested() @Type(()=>Vector3Dto) position:Vector3Dto;
  @ValidateNested() @Type(()=>Vector3Dto) rotation:Vector3Dto;
  @ValidateNested() @Type(()=>Vector3Dto) scale:Vector3Dto;
}
export class UpdateShowroomItemDto{ @IsOptional() @ValidateNested() @Type(()=>Vector3Dto) position?:Vector3Dto; @IsOptional() @ValidateNested() @Type(()=>Vector3Dto) rotation?:Vector3Dto; @IsOptional() @ValidateNested() @Type(()=>Vector3Dto) scale?:Vector3Dto; }
