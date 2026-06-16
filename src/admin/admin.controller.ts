import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  AdminService,
  DashboardStatisticsResponse,
} from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role is required' })
@ApiResponse({ status: 500, description: 'Internal server error' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  @ApiOkResponse({
    description: 'Dashboard statistics returned',
    schema: {
      example: {
        totalUsers: 120,
        totalRooms: 340,
        totalDecorPlans: 215,
        mostPopularStyle: {
          style: 'Minimalist',
          totalDecorPlans: 82,
        },
        mostSavedDecorPlan: {
          decorPlanId: '666f8b1c8a7f5e0012a44401',
          savedCount: 27,
          style: 'Modern',
          estimatedCost: 4500000,
          designSuggestion: 'Use clean lines and warm neutral accents.',
        },
      },
    },
  })
  getDashboard(): Promise<DashboardStatisticsResponse> {
    return this.adminService.getDashboardStatistics();
  }
}
