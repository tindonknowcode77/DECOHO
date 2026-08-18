import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFloatPipe,
  Patch,
  Post,
  Req,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiFoundResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdminUpdateProductDto } from './dto/admin-update-product.dto';
import { ReviewProductDto } from './dto/review-product.dto';
import { ProductStatus } from './product.schema';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiResponse({ status: 500, description: 'Internal server error' })
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPPLIER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product. Admin or supplier.' })
  @ApiCreatedResponse({ description: 'Product created' })
  @ApiResponse({ status: 400, description: 'Invalid product payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  @ApiForbiddenResponse({ description: 'Admin or supplier role is required' })
  create(
    @Body() createProductDto: CreateProductDto,
    @Req() request: Request & { user?: { sub?: string; role?: string } },
  ) {
    const supplierId =
      request.user?.role === Role.SUPPLIER ? request.user.sub : undefined;
    return this.productsService.createForOwner(createProductDto, supplierId);
  }

  @Get('supplier/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPPLIER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get products owned by the current supplier' })
  @ApiOkResponse({ description: 'Supplier products returned' })
  getMyProducts(
    @Req() request: Request & { user?: { sub?: string } },
  ) {
    return this.productsService.findBySupplier(request.user!.sub!);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: list all products by status or supplier' })
  getAllForAdmin(
    @Query('q') query?: string,
    @Query('status') status?: ProductStatus,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.productsService.findAllForAdmin({ query, status, supplierId });
  }

  @Patch('admin/:id/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: edit product, stock, price, image, featured and discount' })
  updateForAdmin(
    @Param('id') id: string,
    @Body() dto: AdminUpdateProductDto,
  ) {
    return this.productsService.updateForAdmin(id, dto);
  }

  @Patch('admin/:id/moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: approve, reject, hide, lock or unlock a product' })
  moderate(
    @Param('id') id: string,
    @Body() dto: ReviewProductDto,
    @Req() request: Request & { user?: { sub?: string } },
  ) {
    return this.productsService.moderate(
      id,
      dto.action,
      request.user!.sub!,
      dto.reason,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPPLIER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an owned product. Admin may update any product.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() request: Request & { user?: { sub?: string; role?: string } },
  ) {
    return this.productsService.updateOwned(
      id,
      dto,
      request.user!.sub!,
      request.user?.role === Role.ADMIN || request.user?.role === Role.SUPER_ADMIN,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPPLIER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an owned product. Admin may delete any product.' })
  async remove(
    @Param('id') id: string,
    @Req() request: Request & { user?: { sub?: string; role?: string } },
  ) {
    await this.productsService.deleteOwned(
      id,
      request.user!.sub!,
      request.user?.role === Role.ADMIN || request.user?.role === Role.SUPER_ADMIN,
    );
    return { message: 'Product deleted successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiOkResponse({ description: 'Products returned' })
  findAll() {
    return this.productsService.findAll();
  }

  @Get('style/:style')
  @ApiOperation({ summary: 'Get products by style tag' })
  @ApiParam({ name: 'style', example: 'minimalist' })
  @ApiOkResponse({ description: 'Products returned' })
  findByStyle(@Param('style') style: string) {
    return this.productsService.findByStyle(style);
  }

  @Get('budget/:amount')
  @ApiOperation({ summary: 'Get products within a budget amount' })
  @ApiParam({ name: 'amount', example: 500 })
  @ApiOkResponse({ description: 'Products returned' })
  @ApiResponse({ status: 400, description: 'Invalid budget amount' })
  findByBudget(@Param('amount', ParseFloatPipe) amount: number) {
    return this.productsService.findByBudget(amount);
  }

  @Get(':id/redirect')
  @ApiOperation({
    summary: 'Redirect to the third-party ecommerce product page',
    description:
      'Use this URL from the frontend when the user clicks a product card or buy button.',
  })
  @ApiParam({ name: 'id', description: 'Product id' })
  @ApiFoundResponse({
    description: 'Redirects to productLink, for example Shopee/Lazada/Tiki.',
  })
  @ApiResponse({ status: 400, description: 'Invalid product id or URL' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async redirectToExternalProduct(
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const productLink = await this.productsService.getRedirectLink(id);

    return response.redirect(302, productLink);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by id' })
  @ApiParam({ name: 'id', description: 'Product id' })
  @ApiOkResponse({ description: 'Product returned' })
  @ApiResponse({ status: 400, description: 'Invalid product id' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }
}
