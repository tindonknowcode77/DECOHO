import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupplierApplicationDto {
  @ApiProperty({ example: 'Mộc An Furniture' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  storeName: string;

  @ApiPropertyOptional({
    example: 'Nhà cung cấp nội thất gỗ và sofa phong cách Japandi.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ example: '0312345678' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessLicenseNumber?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/decoho/license.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  businessLicenseUrl?: string;

  @ApiPropertyOptional({ example: '123 Nguyễn Huệ, Quận 1, TP.HCM' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  businessAddress?: string;
}
