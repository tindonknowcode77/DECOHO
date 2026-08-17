import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Brand, BrandDocument } from '../brands/brand.schema';
import { Category, CategoryDocument } from '../categories/category.schema';
import { Product, ProductDocument, ProductStatus } from '../products/product.schema';
import { Room, RoomDocument } from '../rooms/room.schema';
import { SupplierApplicationStatus, User, UserDocument, UserRole, UserStatus } from '../users/user.schema';
import { SearchLog, SearchLogDocument } from './search-log.schema';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categories: Model<CategoryDocument>,
    @InjectModel(Brand.name) private readonly brands: Model<BrandDocument>,
    @InjectModel(Room.name) private readonly rooms: Model<RoomDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(SearchLog.name) private readonly logs: Model<SearchLogDocument>,
  ) {}

  async search(rawQuery: string, sessionId?: string, limit = 6) {
    const query = rawQuery?.trim();
    if (!query || query.length < 2) throw new BadRequestException('Search query must contain at least 2 characters');
    const safeLimit = Math.min(20, Math.max(1, limit)); const pattern = new RegExp(this.escape(query), 'i');
    const [products, categories, brands, moodboards, suppliers] = await Promise.all([
      this.products.find({ status: ProductStatus.Approved, isLocked: { $ne: true }, $or: [{ name: pattern }, { category: pattern }, { styleTags: pattern }] }).select('name price salePrice image category styleTags').limit(safeLimit).lean().exec(),
      this.categories.find({ isActive: true, name: pattern }).select('name slug imageUrl').limit(safeLimit).lean().exec(),
      this.brands.find({ isActive: true, name: pattern }).select('name slug logoUrl description').limit(safeLimit).lean().exec(),
      this.rooms.find({ isPublic: true, $or: [{ title: pattern }, { description: pattern }] }).select('title imageUrl roomType description productPoints').limit(safeLimit).lean().exec(),
      this.users.find({ role: UserRole.Supplier, status: UserStatus.Active, supplierApplicationStatus: SupplierApplicationStatus.Approved, supplierStoreName: pattern }).select('supplierStoreName supplierDescription businessAddress avatar').limit(safeLimit).lean().exec(),
    ]);
    const resultCount = products.length + categories.length + brands.length + moodboards.length + suppliers.length;
    if (sessionId?.trim()) await this.logs.create({ query: query.toLowerCase(), sessionId: sessionId.trim().slice(0, 100), resultCount });
    return { query, resultCount, products, categories, brands, moodboards, suppliers };
  }

  async history(sessionId: string) {
    if (!sessionId?.trim()) throw new BadRequestException('sessionId is required');
    return this.logs.aggregate([{ $match: { sessionId: sessionId.trim() } }, { $sort: { createdAt: -1 } }, { $group: { _id: '$query', searchedAt: { $first: '$createdAt' }, resultCount: { $first: '$resultCount' }, count: { $sum: 1 } } }, { $sort: { searchedAt: -1 } }, { $limit: 10 }, { $project: { _id: 0, query: '$_id', searchedAt: 1, resultCount: 1, count: 1 } }]).exec();
  }

  async trending() { return this.logs.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: '$query', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }, { $project: { _id: 0, query: '$_id', count: 1 } }]).exec(); }
  private escape(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
}
