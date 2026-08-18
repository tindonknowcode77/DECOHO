import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import {
  SupplierApplicationStatus,
  UserRole,
  UserStatus,
} from '../users/user.schema';
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
import { normalizeRole, Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  AdminService,
  DashboardStatisticsResponse,
  RevenuePeriod,
} from './admin.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ReviewSupplierApplicationDto } from './dto/review-supplier-application.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateSupplierStatusDto } from './dto/update-supplier-status.dto';

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

  @Get('dashboard/revenue')
  @ApiOperation({ summary: 'Get revenue chart by day, month, or year' })
  @ApiOkResponse({ description: 'Revenue chart returned' })
  getRevenueChart(@Query('period') period?: RevenuePeriod) {
    return this.adminService.getRevenueChart(period ?? RevenuePeriod.Day);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all active and suspended users' })
  @ApiOkResponse({ description: 'Users returned' })
  getUsers(
    @Query('q') query?: string,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getUsers({
      query,
      role,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details and purchase history' })
  @ApiOkResponse({ description: 'User details returned' })
  getUserDetails(@Param('id') userId: string) {
    return this.adminService.getUserDetails(userId);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Activate or suspend a non-admin user' })
  @ApiOkResponse({ description: 'User status updated' })
  updateUserStatus(
    @Param('id') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() request: Request & { user?: { role?: string } },
  ) {
    return this.adminService.updateUserStatus(
      userId,
      dto.status,
      normalizeRole(request.user?.role) ?? Role.ADMIN,
    );
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change a user role. Admin only.' })
  @ApiOkResponse({ description: 'User role updated' })
  updateUserRole(
    @Param('id') userId: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() request: Request & { user?: { role?: string } },
  ) {
    return this.adminService.updateUserRole(
      userId,
      dto.role,
      normalizeRole(request.user?.role) ?? Role.ADMIN,
    );
  }

  @Get('supplier-applications')
  @ApiOperation({ summary: 'List pending supplier applications' })
  @ApiOkResponse({ description: 'Pending supplier applications returned' })
  getPendingSupplierApplications() {
    return this.adminService.getPendingSupplierApplications();
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'List suppliers and supplier applications' })
  @ApiOkResponse({ description: 'Suppliers returned' })
  getSuppliers(
    @Query('q') query?: string,
    @Query('status') status?: SupplierApplicationStatus,
  ) {
    return this.adminService.getSuppliers({ query, status });
  }

  @Get('suppliers/:id')
  @ApiOperation({ summary: 'Get supplier license, products, orders and revenue' })
  @ApiOkResponse({ description: 'Supplier details returned' })
  getSupplierDetails(@Param('id') userId: string) {
    return this.adminService.getSupplierDetails(userId);
  }

  @Patch('suppliers/:id/status')
  @ApiOperation({ summary: 'Suspend or reactivate a supplier' })
  @ApiOkResponse({ description: 'Supplier status updated' })
  updateSupplierStatus(
    @Param('id') userId: string,
    @Body() dto: UpdateSupplierStatusDto,
  ) {
    return this.adminService.updateSupplierStatus(
      userId,
      dto.action,
      dto.reason,
    );
  }

  @Patch('supplier-applications/:id')
  @ApiOperation({ summary: 'Approve or reject a supplier application' })
  @ApiOkResponse({ description: 'Supplier application reviewed' })
  reviewSupplierApplication(
    @Param('id') userId: string,
    @Body() dto: ReviewSupplierApplicationDto,
  ) {
    return this.adminService.reviewSupplierApplication(
      userId,
      dto.decision,
      dto.note,
    );
  }
}
