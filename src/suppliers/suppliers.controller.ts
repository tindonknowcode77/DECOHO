import { Body, Controller, Get, Param, Patch, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateSupplierOrderDto } from './dto/update-supplier-order.dto';
import { UpdateSupplierProfileDto } from './dto/update-supplier-profile.dto';
import { SuppliersService } from './suppliers.service';

type SupplierRequest = Request & { user?: { sub?: string } };

@ApiTags('Supplier Center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPPLIER)
@Controller('supplier')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get('me') @ApiOperation({ summary: 'Supplier: get complete store and approval profile' })
  profile(@Req() request: SupplierRequest) { return this.service.profile(this.id(request)); }

  @Patch('me') @ApiOperation({ summary: 'Supplier: update store, contact, policies and payout information' })
  updateProfile(@Req() request: SupplierRequest, @Body() dto: UpdateSupplierProfileDto) { return this.service.updateProfile(this.id(request), dto); }

  @Get('dashboard') @ApiOperation({ summary: 'Supplier: dashboard totals, revenue, orders, reviews and low stock' })
  dashboard(@Req() request: SupplierRequest) { return this.service.dashboard(this.id(request)); }

  @Get('products') @ApiOperation({ summary: 'Supplier: list own products with filters and pagination' })
  products(@Req() request: SupplierRequest, @Query('status') status?: string, @Query('query') query?: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.service.listProducts(this.id(request), { status, query, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined }); }

  @Get('orders') @ApiOperation({ summary: 'Supplier: list orders containing own products only' })
  orders(@Req() request: SupplierRequest, @Query('status') status?: string, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.service.listOrders(this.id(request), { status, dateFrom, dateTo, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined }); }

  @Get('orders/:id') @ApiOperation({ summary: 'Supplier: get one own order with supplier line items' })
  order(@Req() request: SupplierRequest, @Param('id') orderId: string) { return this.service.orderDetails(this.id(request), orderId); }

  @Patch('orders/:id/status') @ApiOperation({ summary: 'Supplier: confirm, process, ship or deliver an order' })
  updateOrder(@Req() request: SupplierRequest, @Param('id') orderId: string, @Body() dto: UpdateSupplierOrderDto) { return this.service.updateOrder(this.id(request), orderId, dto); }

  @Get('payouts') @ApiOperation({ summary: 'Supplier: view own transactions, platform fees and payouts' })
  payouts(@Req() request: SupplierRequest, @Query('status') status?: string, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.service.payouts(this.id(request), { status, dateFrom, dateTo, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined }); }

  @Get('reviews') @ApiOperation({ summary: 'Supplier: view reviews for own products' })
  reviews(@Req() request: SupplierRequest, @Query('status') status?: string, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.service.listReviews(this.id(request), { status, dateFrom, dateTo, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined }); }

  private id(request: SupplierRequest) { const id = request.user?.sub; if (!id) throw new UnauthorizedException('Authenticated supplier id is missing'); return id; }
}
