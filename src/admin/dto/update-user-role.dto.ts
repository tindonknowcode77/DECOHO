import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { UserRole } from '../../users/user.schema';

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: [UserRole.User, UserRole.Staff, UserRole.Admin, UserRole.SuperAdmin],
    example: UserRole.Staff,
    description:
      'USER, STAFF, ADMIN hoặc SUPER_ADMIN. SUPPLIER được cấp qua quy trình duyệt đơn.',
  })
  @IsIn([UserRole.User, UserRole.Staff, UserRole.Admin, UserRole.SuperAdmin])
  role: UserRole.User | UserRole.Staff | UserRole.Admin | UserRole.SuperAdmin;
}
