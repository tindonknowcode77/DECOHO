import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite, FavoriteDocument } from './favorite.schema';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
  ) {}

  private validateId(id: string, label = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid ${label}`);
    }
  }

  async add(userId: string, decorPlanId: string): Promise<Favorite> {
    this.validateId(userId, 'user');
    this.validateId(decorPlanId, 'decor plan');

    const existing = await this.favoriteModel
      .findOne({ userId: new Types.ObjectId(userId), decorPlanId: new Types.ObjectId(decorPlanId) })
      .exec();

    if (existing) {
      throw new ConflictException('Already in favorites');
    }

    const doc = new this.favoriteModel({
      userId: new Types.ObjectId(userId),
      decorPlanId: new Types.ObjectId(decorPlanId),
    });

    return (await doc.save()).toObject() as Favorite;
  }

  async remove(userId: string, decorPlanId: string): Promise<void> {
    this.validateId(userId, 'user');
    this.validateId(decorPlanId, 'decor plan');

    const result = await this.favoriteModel
      .deleteOne({
        userId: new Types.ObjectId(userId),
        decorPlanId: new Types.ObjectId(decorPlanId),
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Not in favorites');
    }
  }

  async getAll(userId: string): Promise<Favorite[]> {
    this.validateId(userId, 'user');

    const favorites = await this.favoriteModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return favorites as Favorite[];
  }

  async getIds(userId: string): Promise<string[]> {
    this.validateId(userId, 'user');

    const favorites = await this.favoriteModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('decorPlanId')
      .lean()
      .exec();

    return favorites.map((f) => (f.decorPlanId as Types.ObjectId).toString());
  }

  async check(userId: string, decorPlanId: string): Promise<boolean> {
    this.validateId(userId, 'user');
    this.validateId(decorPlanId, 'decor plan');

    const count = await this.favoriteModel
      .countDocuments({
        userId: new Types.ObjectId(userId),
        decorPlanId: new Types.ObjectId(decorPlanId),
      })
      .exec();

    return count > 0;
  }
}
