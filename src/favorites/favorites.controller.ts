import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Favorite } from './favorite.schema';
import { FavoritesService } from './favorites.service';

class SaveFavoriteRequestDto {
  @ApiProperty({ example: '666f8b1c8a7f5e0012a44401' })
  @IsMongoId()
  decorPlanId: string;
}

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    userId?: string;
    id?: string;
    _id?: string;
  };
};

@ApiTags('Favorites')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiResponse({ status: 500, description: 'Internal server error' })
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Save a decor plan to favorites' })
  @ApiBody({ type: SaveFavoriteRequestDto })
  @ApiCreatedResponse({ description: 'Decor plan saved to favorites' })
  @ApiResponse({ status: 400, description: 'Invalid favorite payload' })
  @ApiResponse({ status: 404, description: 'Decor plan not found' })
  @ApiResponse({ status: 409, description: 'Decor plan is already saved' })
  saveDecorPlan(
    @Req() request: AuthenticatedRequest,
    @Body() saveFavoriteDto: SaveFavoriteRequestDto,
  ): Promise<Favorite> {
    return this.favoritesService.saveDecorPlan(
      this.getCurrentUserId(request),
      saveFavoriteDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all favorites owned by current user' })
  @ApiOkResponse({ description: 'Favorites returned' })
  @ApiResponse({ status: 400, description: 'Invalid authenticated user id' })
  getFavorites(@Req() request: AuthenticatedRequest): Promise<Favorite[]> {
    return this.favoritesService.getFavorites(this.getCurrentUserId(request));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a favorite owned by current user' })
  @ApiParam({ name: 'id', description: 'Favorite id' })
  @ApiNoContentResponse({ description: 'Favorite removed' })
  @ApiResponse({ status: 400, description: 'Invalid favorite id' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  async removeFavorite(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.favoritesService.removeFavorite(
      this.getCurrentUserId(request),
      id,
    );
  }

  private getCurrentUserId(request: AuthenticatedRequest): string {
    const user = request.user;
    const userId = user?.sub ?? user?.userId ?? user?.id ?? user?._id;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user id is missing');
    }

    return userId;
  }
}
