import { Type } from 'class-transformer';
import { IsBoolean, IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
export class UpdateDetectionDto{
  @IsOptional() @IsString() name?:string;
  @IsOptional() @IsString() category?:string;
  @IsOptional() @IsString() material?:string;
  @IsOptional() @IsString() color?:string;
  @IsOptional() @IsString() style?:string;
  @IsOptional() @IsString() dimensions?:string;
  @IsOptional() @IsMongoId() linkedProductId?:string;
}
export class UpdateScannerConfigDto{
  @IsOptional() @IsString() model?:string;
  @IsOptional() @Type(()=>Number) @IsNumber() @Min(0) @Max(1) confidenceThreshold?:number;
  @IsOptional() @IsBoolean() isActive?:boolean;
}
