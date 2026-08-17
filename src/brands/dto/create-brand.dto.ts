import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Mộc An' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ example: 'https://example.com/logos/moc-an.png' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'Nội thất gỗ phong cách Japandi.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
