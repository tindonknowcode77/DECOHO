import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateProductSpaceDto } from './dto/create-product-space.dto';
import { ProductPointDto } from './dto/product-point.dto';
import { UpdateProductSpaceDto } from './dto/update-product-space.dto';
import { RoomsService } from './rooms.service';

type AdminRequest = Request & { user?: { sub?: string } };

@ApiTags('Product Spaces')
@Controller('product-spaces')
export class ProductSpacesController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List public Product Spaces, featured first' })
  listPublic() { return this.roomsService.getProductSpaces(true); }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List Product Spaces created by the current user' })
  listMine(@Req() request: AdminRequest) {
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException('Authenticated user id is missing');
    return this.roomsService.getUserProductSpaces(userId);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Create a personal Moodboard from a room image' })
  uploadPersonal(@Req() request: AdminRequest, @Body() dto: CreateProductSpaceDto, @UploadedFile() image: Express.Multer.File) {
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException('Authenticated user id is missing');
    dto.isFeatured = false;
    return this.roomsService.uploadRoom(userId, dto, image);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: list all Product Spaces' })
  listAll() { return this.roomsService.getProductSpaces(); }

  @Post('admin/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Admin: upload and create a Product Space' })
  upload(@Req() request: AdminRequest, @Body() dto: CreateProductSpaceDto, @UploadedFile() image: Express.Multer.File) {
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException('Authenticated user id is missing');
    return this.roomsService.uploadRoom(userId, dto, image);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: update title, visibility or featured state' })
  update(@Param('id') id:string, @Body() dto:UpdateProductSpaceDto) { return this.roomsService.updateProductSpace(id,dto); }

  @Post('admin/:id/points')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: attach a product point to a Product Space' })
  addPoint(@Param('id') id:string, @Body() dto:ProductPointDto) { return this.roomsService.addProductPoint(id,dto); }

  @Patch('admin/:id/points/:pointId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: update product and coordinates of a point' })
  updatePoint(@Param('id') id:string,@Param('pointId') pointId:string,@Body() dto:ProductPointDto) { return this.roomsService.updateProductPoint(id,pointId,dto); }

  @Delete('admin/:id/points/:pointId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: remove a product point' })
  deletePoint(@Param('id') id:string,@Param('pointId') pointId:string) { return this.roomsService.deleteProductPoint(id,pointId); }

  @Get(':id')
  @ApiOperation({ summary: 'Preview one public Product Space with product points' })
  preview(@Param('id') id:string) { return this.roomsService.getPublicProductSpace(id); }
}
