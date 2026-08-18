import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsNumber, IsObject, IsOptional, IsString, Length, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class UserPreferencesDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  styles?: string[];

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({ example: 'VND' })
  @IsOptional() @IsString() @Length(3, 3)
  currency?: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString() @MinLength(2) @MaxLength(160)
  fullName: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail() @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 6 })
  @IsString() @MinLength(6) @MaxLength(72)
  password: string;

  @ApiPropertyOptional({ type: UserPreferencesDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;
}
