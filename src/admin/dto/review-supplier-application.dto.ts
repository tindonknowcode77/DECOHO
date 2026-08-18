import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum SupplierReviewDecision {
  Approve = 'APPROVE',
  Reject = 'REJECT',
  RequestInformation = 'REQUEST_INFORMATION',
}

export class ReviewSupplierApplicationDto {
  @ApiProperty({ enum: SupplierReviewDecision })
  @IsEnum(SupplierReviewDecision)
  decision: SupplierReviewDecision;

  @ApiPropertyOptional({ example: 'Vui lòng bổ sung giấy tờ doanh nghiệp.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
