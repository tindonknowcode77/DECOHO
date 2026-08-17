import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdminUpdateProductDto } from './dto/admin-update-product.dto';
import { ProductModerationAction } from './dto/review-product.dto';
import {
  EcommercePlatform,
  Product,
  ProductDocument,
  ProductStatus,
} from './product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    return this.createForOwner(createProductDto);
  }

  async createForOwner(
    createProductDto: CreateProductDto,
    supplierId?: string,
  ): Promise<Product> {
    const product = await this.productModel.create({
      ...createProductDto,
      ...(supplierId ? { supplierId: new Types.ObjectId(supplierId) } : {}),
      name: createProductDto.name.trim(),
      category: this.normalizeLabel(createProductDto.category),
      ecommercePlatform: this.normalizePlatform(
        createProductDto.ecommercePlatform,
      ),
      image: this.normalizeHttpUrl(createProductDto.image),
      productLink: this.normalizeHttpUrl(createProductDto.productLink),
      styleTags: createProductDto.styleTags.map((tag) =>
        this.normalizeLabel(tag),
      ),
      status: supplierId ? ProductStatus.Pending : ProductStatus.Approved,
    });

    return product;
  }

  async findBySupplier(supplierId: string): Promise<Product[]> {
    this.assertValidObjectId(supplierId);
    return this.productModel
      .find({ supplierId: new Types.ObjectId(supplierId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllForAdmin(filters: {
    query?: string;
    status?: ProductStatus;
    supplierId?: string;
  }): Promise<Product[]> {
    const filter: Record<string, unknown> = {};
    if (filters.status) filter.status = filters.status;
    if (filters.supplierId) {
      this.assertValidObjectId(filters.supplierId);
      filter.supplierId = new Types.ObjectId(filters.supplierId);
    }
    if (filters.query?.trim()) {
      const escaped = filters.query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const search = new RegExp(escaped, 'i');
      filter.$or = [{ name: search }, { category: search }, { styleTags: search }];
    }
    return this.productModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async updateForAdmin(
    productId: string,
    dto: AdminUpdateProductDto,
  ): Promise<Product> {
    const product = await this.updateOwned(productId, dto, productId, true);
    const discount = dto.discountPercent ?? product.discountPercent ?? 0;
    const salePrice = discount > 0
      ? Math.round(product.price * (1 - discount / 100))
      : product.price;
    let status = product.status;
    if (product.stock === 0 && product.status === ProductStatus.Approved) {
      status = ProductStatus.OutOfStock;
    } else if (product.stock > 0 && product.status === ProductStatus.OutOfStock) {
      status = ProductStatus.Approved;
    }
    const updated = await this.productModel
      .findByIdAndUpdate(
        productId,
        { $set: { discountPercent: discount, salePrice, status } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Product not found');
    return updated;
  }

  async moderate(
    productId: string,
    action: ProductModerationAction,
    reviewerId: string,
    reason?: string,
  ): Promise<Product> {
    this.assertValidObjectId(productId);
    this.assertValidObjectId(reviewerId);
    if (
      [ProductModerationAction.Reject, ProductModerationAction.Hide, ProductModerationAction.Lock].includes(action) &&
      !reason?.trim()
    ) {
      throw new BadRequestException('A moderation reason is required');
    }
    const statusByAction: Partial<Record<ProductModerationAction, ProductStatus>> = {
      [ProductModerationAction.Approve]: ProductStatus.Approved,
      [ProductModerationAction.Reject]: ProductStatus.Rejected,
      [ProductModerationAction.Hide]: ProductStatus.Hidden,
    };
    const update: Record<string, unknown> = {
      reviewedAt: new Date(),
      reviewedBy: new Types.ObjectId(reviewerId),
      moderationReason: reason?.trim(),
    };
    if (statusByAction[action]) update.status = statusByAction[action];
    if (action === ProductModerationAction.Lock) update.isLocked = true;
    if (action === ProductModerationAction.Unlock) {
      update.isLocked = false;
      update.moderationReason = undefined;
    }
    const product = await this.productModel.findByIdAndUpdate(
      productId,
      { $set: update },
      { new: true, runValidators: true },
    ).exec();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async updateOwned(
    productId: string,
    updateProductDto: UpdateProductDto,
    actorId: string,
    isAdmin: boolean,
  ): Promise<Product> {
    this.assertValidObjectId(productId);
    this.assertValidObjectId(actorId);

    const update: Record<string, unknown> = { ...updateProductDto };
    if (updateProductDto.name !== undefined) {
      update.name = updateProductDto.name.trim();
    }
    if (updateProductDto.category !== undefined) {
      update.category = this.normalizeLabel(updateProductDto.category);
    }
    if (updateProductDto.image !== undefined) {
      update.image = this.normalizeHttpUrl(updateProductDto.image);
    }
    if (updateProductDto.productLink !== undefined) {
      update.productLink = this.normalizeHttpUrl(updateProductDto.productLink);
    }
    if (updateProductDto.styleTags !== undefined) {
      update.styleTags = updateProductDto.styleTags.map((tag) =>
        this.normalizeLabel(tag),
      );
    }
    if (!isAdmin) {
      update.status = ProductStatus.Pending;
      update.moderationReason = undefined;
    }

    const product = await this.productModel
      .findOneAndUpdate(
        isAdmin
          ? { _id: productId }
          : { _id: productId, supplierId: new Types.ObjectId(actorId) },
        { $set: update },
        { new: true, runValidators: true },
      )
      .exec();

    if (!product) {
      throw new NotFoundException('Product not found or not owned by supplier');
    }
    return product;
  }

  async deleteOwned(
    productId: string,
    actorId: string,
    isAdmin: boolean,
  ): Promise<void> {
    this.assertValidObjectId(productId);
    this.assertValidObjectId(actorId);
    const product = await this.productModel
      .findOneAndDelete(
        isAdmin
          ? { _id: productId }
          : { _id: productId, supplierId: new Types.ObjectId(actorId) },
      )
      .exec();
    if (!product) {
      throw new NotFoundException('Product not found or not owned by supplier');
    }
  }

  async findAll(): Promise<Product[]> {
    return this.productModel
      .find({
        isLocked: { $ne: true },
        $or: [
          { status: ProductStatus.Approved },
          { status: ProductStatus.OutOfStock },
          { status: { $exists: false } },
        ],
      })
      .sort({ isFeatured: -1, createdAt: -1 })
      .exec();
  }

  async findById(productId: string): Promise<Product> {
    this.assertValidObjectId(productId);

    const product = await this.productModel
      .findOne({
        _id: productId,
        isLocked: { $ne: true },
        $or: [{ status: ProductStatus.Approved }, { status: ProductStatus.OutOfStock }, { status: { $exists: false } }],
      })
      .exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findByStyle(style: string): Promise<Product[]> {
    const normalizedStyle = this.normalizeLabel(style);

    return this.productModel
      .find({ styleTags: normalizedStyle, isLocked: { $ne: true }, $or: [{ status: ProductStatus.Approved }, { status: ProductStatus.OutOfStock }, { status: { $exists: false } }] })
      .sort({ price: 1, createdAt: -1 })
      .exec();
  }

  async findByBudget(amount: number): Promise<Product[]> {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Budget amount must be a positive number');
    }

    return this.productModel
      .find({ price: { $lte: amount }, isLocked: { $ne: true }, $or: [{ status: ProductStatus.Approved }, { status: ProductStatus.OutOfStock }, { status: { $exists: false } }] })
      .sort({ price: 1, createdAt: -1 })
      .exec();
  }

  async getRedirectLink(productId: string): Promise<string> {
    const product = await this.findById(productId);

    return this.normalizeHttpUrl(product.productLink);
  }

  private normalizeLabel(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizePlatform(platform: EcommercePlatform): EcommercePlatform {
    return platform;
  }

  private normalizeHttpUrl(value: string): string {
    let url: URL;

    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestException('Invalid product URL');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('Only http and https links are allowed');
    }

    return url.toString();
  }

  private assertValidObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid product id');
    }
  }
}
