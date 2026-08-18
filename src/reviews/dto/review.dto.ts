import { Type } from 'class-transformer';
import { IsArray, IsInt, IsMongoId, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
export class CreateReviewDto{@IsMongoId()productId:string;@IsOptional()@IsMongoId()orderId?:string;@Type(()=>Number)@IsInt()@Min(1)@Max(5)rating:number;@IsString()@MaxLength(3000)content:string;@IsOptional()@IsArray()@IsUrl({}, {each:true})images?:string[];}
export class ReportReviewDto{@IsString()@MaxLength(500)reason:string;}
export class ModerateReviewDto{@IsString()@MaxLength(1000)reason:string;}
export class ResolveReviewReportDto{@IsMongoId()reportId:string;@IsString()@MaxLength(500)resolution:string;}
