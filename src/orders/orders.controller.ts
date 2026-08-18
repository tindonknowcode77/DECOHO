import { Body, Controller, Get, Param, ParseEnumPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderReasonDto, RefundOrderDto, ResolveComplaintDto } from './dto/order-reason.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from './order.schema';
import { OrdersService } from './orders.service';

type AuthRequest = Request & { user?: { sub?: string } };

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an order for the authenticated user' })
  @ApiCreatedResponse({ description: 'Order created' })
  create(@Req() request: AuthRequest, @Body() dto: CreateOrderDto) { return this.ordersService.create(request.user!.sub!, dto); }

  @Get('mine')
  @ApiOperation({ summary: 'Get orders of the authenticated user' })
  findMine(@Req() request: AuthRequest) { return this.ordersService.findMine(request.user!.sub!); }

  @Post('mine/:id/complaint')
  @ApiOperation({ summary: 'Open a complaint for an owned order' })
  openComplaint(@Param('id') id: string, @Req() request: AuthRequest, @Body() dto: OrderReasonDto) { return this.ordersService.openComplaint(id, request.user!.sub!, dto.reason); }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: list and filter every order' })
  findAllForAdmin(
    @Query('supplierId') supplierId?: string, @Query('userId') userId?: string,
    @Query('status') status?: OrderStatus, @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string, @Query('page') page?: string, @Query('limit') limit?: string,
  ) { return this.ordersService.findAllForAdmin({ supplierId, userId, status, dateFrom, dateTo, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined }); }

  @Get('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: get order details' })
  findById(@Param('id') id: string) { return this.ordersService.findById(id); }

  @Patch('admin/:id/status/:status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: update order workflow status' })
  transition(@Param('id') id: string, @Param('status', new ParseEnumPipe(OrderStatus)) status: OrderStatus, @Req() request: AuthRequest, @Body() dto: UpdateOrderStatusDto) { return this.ordersService.transition(id, status, request.user!.sub!, dto); }

  @Patch('admin/:id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: cancel an order' })
  cancel(@Param('id') id: string, @Req() request: AuthRequest, @Body() dto: OrderReasonDto) { return this.ordersService.cancel(id, request.user!.sub!, dto.reason); }

  @Patch('admin/:id/refund')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: refund an order' })
  refund(@Param('id') id: string, @Req() request: AuthRequest, @Body() dto: RefundOrderDto) { return this.ordersService.refund(id, request.user!.sub!, dto.reason, dto.amount); }

  @Patch('admin/:id/complaint/resolve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: resolve an order complaint' })
  resolveComplaint(@Param('id') id: string, @Body() dto: ResolveComplaintDto) { return this.ordersService.resolveComplaint(id, dto.resolution); }
}
