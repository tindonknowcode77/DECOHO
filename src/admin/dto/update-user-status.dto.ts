import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { UserStatus } from '../../users/user.schema';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: [UserStatus.Active, UserStatus.Suspended] })
  @IsIn([UserStatus.Active, UserStatus.Suspended])
  status: UserStatus.Active | UserStatus.Suspended;
}
