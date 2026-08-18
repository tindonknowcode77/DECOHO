import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { LinkBrandSuppliersDto } from './dto/link-brand-suppliers.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { SetBrandVisibilityDto } from './dto/set-brand-visibility.dto';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'Get visible brands' })
  findPublic() { return this.brandsService.findPublic(); }

  @Get(':id/products')
  @ApiOperation({ summary: 'Get public products by brand' })
  getPublicProducts(@Param('id') id: string) { return this.brandsService.getProducts(id); }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: get all brands including hidden brands' })
  findAllForAdmin() { return this.brandsService.findAllForAdmin(); }

  @Get('admin/:id/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: get every product by brand' })
  getAllProducts(@Param('id') id: string) { return this.brandsService.getProducts(id, true); }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Brand created' })
  create(@Body() dto: CreateBrandDto) { return this.brandsService.create(dto); }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto) { return this.brandsService.update(id, dto); }

  @Patch(':id/visibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Brand visibility updated' })
  setVisibility(@Param('id') id: string, @Body() dto: SetBrandVisibilityDto) { return this.brandsService.setVisibility(id, dto.isActive); }

  @Put(':id/suppliers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link approved suppliers to a brand' })
  linkSuppliers(@Param('id') id: string, @Body() dto: LinkBrandSuppliersDto) { return this.brandsService.linkSuppliers(id, dto.supplierIds); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async remove(@Param('id') id: string): Promise<void> { await this.brandsService.remove(id); }
}
