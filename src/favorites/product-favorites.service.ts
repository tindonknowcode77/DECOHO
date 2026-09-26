import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductFavorite, ProductFavoriteDocument } from './product-favorite.schema';

@Injectable()
export class ProductFavoritesService {
  constructor(
    @InjectModel(ProductFavorite.name)
    private readonly model: Model<ProductFavoriteDocument>,
  ) {}

  private validateId(id: string, label = 'id'): void {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(`Invalid ${label}`);
  }

  async add(userId: string, productId: string): Promise<{ liked: boolean }> {
    this.validateId(userId, 'user');
    this.validateId(productId, 'product');
    const exists = await this.model
      .findOne({ userId: new Types.ObjectId(userId), productId: new Types.ObjectId(productId) })
      .exec();
    if (!exists) {
      await this.model.create({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
      });
    }
    return { liked: true };
  }

  async remove(userId: string, productId: string): Promise<{ liked: boolean }> {
    this.validateId(userId, 'user');
    this.validateId(productId, 'product');
    await this.model
      .deleteOne({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
      })
      .exec();
    return { liked: false };
  }

  async getIds(userId: string): Promise<string[]> {
    this.validateId(userId, 'user');
    const docs = await this.model
      .find({ userId: new Types.ObjectId(userId) })
      .select('productId')
      .lean()
      .exec();
    return docs.map((d) => (d.productId as Types.ObjectId).toString());
  }

  async getAll(userId: string): Promise<ProductFavorite[]> {
    this.validateId(userId, 'user');
    const docs = await this.model
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs as ProductFavorite[];
  }
}
