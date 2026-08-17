import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

const ages = ['under-18', '18-24', '25-34', '35-plus'] as const;
const budgets = ['under-25m', '25m-75m', '75m-150m', 'over-150m'] as const;

export class CompleteOnboardingDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() skipped?: boolean;
  @ApiPropertyOptional({ enum: ages }) @IsOptional() @IsIn(ages) ageRange?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) rooms?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) styles?: string[];
  @ApiPropertyOptional({ enum: budgets }) @IsOptional() @IsIn(budgets) budget?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(4) @IsString({ each: true }) colors?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) helpOptions?: string[];
}
