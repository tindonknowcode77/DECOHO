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
import { FavoritesService } from './favorites.service';

interface AuthRequest extends Request {
  user: { sub?: string };
}

@ApiTags('Favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  private userId(req: AuthRequest): string {
    const id = req.user?.sub;
    if (!id) throw new UnauthorizedException('Authenticated user id is missing');
    return id;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getAll(@Req() req: AuthRequest) {
    return this.favoritesService.getAll(this.userId(req));
  }

  @Get('ids')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getIds(@Req() req: AuthRequest) {
    return this.favoritesService.getIds(this.userId(req));
  }

  @Post(':decorPlanId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async add(@Req() req: AuthRequest, @Param('decorPlanId') decorPlanId: string) {
    return this.favoritesService.add(this.userId(req), decorPlanId);
  }

  @Delete(':decorPlanId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async remove(@Req() req: AuthRequest, @Param('decorPlanId') decorPlanId: string) {
    await this.favoritesService.remove(this.userId(req), decorPlanId);
    return { success: true };
  }

  @Get(':decorPlanId/check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async check(@Req() req: AuthRequest, @Param('decorPlanId') decorPlanId: string) {
    const isFavorited = await this.favoritesService.check(this.userId(req), decorPlanId);
    return { isFavorited };
  }
}
