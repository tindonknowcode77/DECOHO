import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DecorPlan,
  DecorPlanDocument,
} from '../decor-plans/decor-plan.schema';
import { Favorite, FavoriteDocument } from './favorite.schema';

export type SaveFavoriteDto = {
  decorPlanId: string;
};

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(DecorPlan.name)
    private readonly decorPlanModel: Model<DecorPlanDocument>,
  ) {}

  async saveDecorPlan(
    userId: string,
    saveFavoriteDto: SaveFavoriteDto,
  ): Promise<Favorite> {
    this.assertValidObjectId(userId, 'Invalid user id');
    this.assertValidObjectId(
      saveFavoriteDto.decorPlanId,
      'Invalid decor plan id',
    );

    await this.ensureDecorPlanBelongsToUser(
      userId,
      saveFavoriteDto.decorPlanId,
    );

    const existingFavorite = await this.favoriteModel
      .findOne({
        userId,
        decorPlanId: saveFavoriteDto.decorPlanId,
      })
      .exec();

    if (existingFavorite) {
      throw new ConflictException('Decor plan is already saved');
    }

    const favorite = await this.favoriteModel.create({
      userId: new Types.ObjectId(userId),
      decorPlanId: new Types.ObjectId(saveFavoriteDto.decorPlanId),
    });

    return favorite;
  }

  async getFavorites(userId: string): Promise<Favorite[]> {
    this.assertValidObjectId(userId, 'Invalid user id');

    return this.favoriteModel
      .find({ userId })
      .populate('decorPlanId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async removeFavorite(userId: string, favoriteId: string): Promise<void> {
    this.assertValidObjectId(userId, 'Invalid user id');
    this.assertValidObjectId(favoriteId, 'Invalid favorite id');

    const result = await this.favoriteModel
      .deleteOne({
        _id: favoriteId,
        userId,
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Favorite not found');
    }
  }

  private async ensureDecorPlanBelongsToUser(
    userId: string,
    decorPlanId: string,
  ): Promise<void> {
    const decorPlan = await this.decorPlanModel
      .exists({
        _id: decorPlanId,
        userId,
      })
      .exec();

    if (!decorPlan) {
      throw new NotFoundException('Decor plan not found');
    }
  }

  private assertValidObjectId(id: string, message: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(message);
    }
  }
}
