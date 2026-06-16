import {
  Body,
  Controller,
  Get,
  Param,
  ParseFloatPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiResponse({ status: 500, description: 'Internal server error' })
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product. Admin only.' })
  @ApiCreatedResponse({ description: 'Product created' })
  @ApiResponse({ status: 400, description: 'Invalid product payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
  @ApiForbiddenResponse({ description: 'Admin role is required' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
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
