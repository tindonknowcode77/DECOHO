import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProductFavoritesService } from './product-favorites.service';

interface AuthRequest extends Request {
  user: { sub?: string };
}

@ApiTags('Product Favorites')
@Controller('product-favorites')
export class ProductFavoritesController {
  constructor(private readonly service: ProductFavoritesService) {}

  private userId(req: AuthRequest): string {
    const id = req.user?.sub;
    if (!id) throw new UnauthorizedException('Authenticated user id is missing');
    return id;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getAll(@Req() req: AuthRequest) {
    return this.service.getAll(this.userId(req));
  }

  @Get('ids')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getIds(@Req() req: AuthRequest) {
    return this.service.getIds(this.userId(req));
  }

  @Post(':productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async add(@Req() req: AuthRequest, @Param('productId') productId: string) {
    return this.service.add(this.userId(req), productId);
  }

  @Delete(':productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async remove(@Req() req: AuthRequest, @Param('productId') productId: string) {
    return this.service.remove(this.userId(req), productId);
  }
}
