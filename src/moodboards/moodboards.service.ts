import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Product, ProductDocument } from '../products/product.schema';
import {
  AttachMoodboardProductDto,
  UpdateMoodboardDto,
} from './dto/moodboard-products.dto';
import {
  CreateMoodboardDto,
  MoodboardProductPointInput,
} from './dto/create-moodboard.dto';
import {
  Moodboard,
  MoodboardDocument,
  MoodboardRoomType,
} from './moodboard.schema';

export type MoodboardProductSummary = {
  _id?: string;
  id?: string;
  name?: string;
  price?: number;
  discount?: number;
  stock?: number;
  images?: string[];
  image?: string;
  material?: string;
  category?: string;
  brand?: string;
  color?: string;
  dimensions?: string;
  rating?: number;
  status?: string;
  description?: string;
};

export type MoodboardPointResponse = {
  _id?: string;
  productId: string;
  x: number;
  y: number;
  product?: MoodboardProductSummary;
};

export type MoodboardResponse = {
  _id?: string;
  id?: string;
  moodboardId: string;
  authorId: string;
  authorName?: string;
  title?: string;
  description?: string;
  imageUrl: string;
  imagePublicId?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageFormat?: string;
  imageBytes?: number;
  roomType: MoodboardRoomType;
  tags: string[];
  likes: number;
  views: number;
  isPublic: boolean;
  isFeatured: boolean;
  productPoints: MoodboardPointResponse[];
  productsCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

type MoodboardObject = Moodboard & {
  _id?: Types.ObjectId | { toString(): string };
  id?: string;
  authorId: Types.ObjectId | string | { toString(): string };
  createdAt?: Date;
  updatedAt?: Date;
};

const PRODUCT_FIELDS =
  'name price discount stock images image material category brand color dimensions rating status description';

@Injectable()
export class MoodboardsService {
  private readonly moodboardImagesFolder =
    process.env.CLOUDINARY_MOODBOARDS_FOLDER ??
    `${process.env.CLOUDINARY_FOLDER ?? 'decoho'}/moodboards`;

  constructor(
    @InjectModel(Moodboard.name)
    private readonly moodboardModel: Model<MoodboardDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ---------------------------------------------------------------------------
  // PUBLIC
  // ---------------------------------------------------------------------------

  async listPublic(): Promise<MoodboardResponse[]> {
    const docs = await this.moodboardModel
      .find({ isPublic: true })
      .sort({ isFeatured: -1, createdAt: -1 })
      .populate('productPoints.productId', PRODUCT_FIELDS)
      .exec();
    return docs.map((d) => this.toResponse(d));
  }

  async getPublicById(id: string): Promise<MoodboardResponse> {
    this.assertObjectId(id);
    const doc = await this.moodboardModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), isPublic: true },
        { $inc: { views: 1 } },
        { new: true },
      )
      .populate('productPoints.productId', PRODUCT_FIELDS)
      .exec();
    if (!doc) throw new NotFoundException('Moodboard không tồn tại hoặc chưa công khai');
    return this.toResponse(doc);
  }

  async getProductsByMoodboardId(
    id: string,
  ): Promise<{ moodboardId: string; count: number; items: MoodboardProductSummary[] }> {
    this.assertObjectId(id);
    const doc = await this.moodboardModel
      .findOne({ _id: new Types.ObjectId(id), isPublic: true })
      .select('productPoints')
      .populate('productPoints.productId', PRODUCT_FIELDS)
      .exec();
    if (!doc) throw new NotFoundException('Moodboard không tồn tại hoặc chưa công khai');

    const items: MoodboardProductSummary[] = [];
    for (const point of doc.productPoints ?? []) {
      const pop = point.productId as unknown as Record<string, unknown> | Types.ObjectId | undefined;
      if (pop && typeof pop === 'object' && '_id' in pop) {
        items.push(this.mapProduct(pop as Record<string, unknown>));
      }
    }

    return {
      moodboardId: id,
      count: items.length,
      items,
    };
  }

  async listMine(authorId: string): Promise<MoodboardResponse[]> {
    this.assertObjectId(authorId);
    const docs = await this.moodboardModel
      .find({ authorId: new Types.ObjectId(authorId) })
      .sort({ createdAt: -1 })
      .populate('productPoints.productId', PRODUCT_FIELDS)
      .exec();
    return docs.map((d) => this.toResponse(d));
  }

  async createFromUser(
    authorId: string,
    dto: CreateMoodboardDto,
    file: Express.Multer.File,
  ): Promise<MoodboardResponse> {
    return this.createInternal(authorId, dto, file);
  }

  // ---------------------------------------------------------------------------
  // ADMIN
  // ---------------------------------------------------------------------------

  async listAll(): Promise<MoodboardResponse[]> {
    const docs = await this.moodboardModel
      .find({})
      .sort({ createdAt: -1 })
      .populate('productPoints.productId', PRODUCT_FIELDS)
      .exec();
    return docs.map((d) => this.toResponse(d));
  }

  async createFromAdmin(
    authorId: string,
    dto: CreateMoodboardDto,
    file: Express.Multer.File,
  ): Promise<MoodboardResponse> {
    return this.createInternal(authorId, dto, file);
  }

  async updateMoodboard(
    id: string,
    dto: UpdateMoodboardDto,
  ): Promise<MoodboardResponse> {
    this.assertObjectId(id);
    if (dto.isFeatured === true) {
      await this.moodboardModel
        .updateMany({ _id: { $ne: new Types.ObjectId(id) } }, { $set: { isFeatured: false } })
        .exec();
    }
    const doc = await this.moodboardModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id) },
        { $set: dto },
        { new: true, runValidators: true },
      )
      .populate('productPoints.productId', PRODUCT_FIELDS)
      .exec();
    if (!doc) throw new NotFoundException('Moodboard không tồn tại');
    return this.toResponse(doc);
  }

  async attachProduct(
    id: string,
    dto: AttachMoodboardProductDto,
  ): Promise<MoodboardResponse> {
    this.assertObjectId(id);
    const product = await this.productModel.exists({
      _id: new Types.ObjectId(dto.productId),
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    const doc = await this.moodboardModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id) },
        {
          $push: {
            productPoints: {
              productId: new Types.ObjectId(dto.productId),
              x: dto.x,
              y: dto.y,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .populate('productPoints.productId', PRODUCT_FIELDS)
      .exec();
    if (!doc) throw new NotFoundException('Moodboard không tồn tại');
    return this.toResponse(doc);
  }

  async updateProductPoint(
    id: string,
    pointId: string,
    dto: { x: number; y: number },
  ): Promise<MoodboardResponse> {
    this.assertObjectId(id);
    this.assertObjectId(pointId);
    const doc = await this.moodboardModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          'productPoints._id': new Types.ObjectId(pointId),
        },
        {
          $set: {
            'productPoints.$.x': dto.x,
            'productPoints.$.y': dto.y,
          },
        },
        { new: true, runValidators: true },
      )
      .populate('productPoints.productId', PRODUCT_FIELDS)
      .exec();
    if (!doc) throw new NotFoundException('Moodboard hoặc product point không tồn tại');
    return this.toResponse(doc);
  }

  async removeProductPoint(
    id: string,
    pointId: string,
  ): Promise<MoodboardResponse> {
    this.assertObjectId(id);
    this.assertObjectId(pointId);
    const doc = await this.moodboardModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id) },
        { $pull: { productPoints: { _id: new Types.ObjectId(pointId) } } },
        { new: true },
      )
      .populate('productPoints.productId', PRODUCT_FIELDS)
      .exec();
    if (!doc) throw new NotFoundException('Moodboard hoặc product point không tồn tại');
    return this.toResponse(doc);
  }

  async deleteMoodboard(id: string): Promise<void> {
    this.assertObjectId(id);
    const doc = await this.moodboardModel
      .findByIdAndDelete(new Types.ObjectId(id))
      .exec();
    if (!doc) throw new NotFoundException('Moodboard không tồn tại');
    if (doc.imagePublicId) {
      try {
        await this.cloudinaryService.deleteImage(doc.imagePublicId);
      } catch {
        // best-effort cleanup
      }
    }
  }

  // ---------------------------------------------------------------------------
  // INTERNAL
  // ---------------------------------------------------------------------------

  private async createInternal(
    authorId: string,
    dto: CreateMoodboardDto,
    file: Express.Multer.File,
  ): Promise<MoodboardResponse> {
    this.assertObjectId(authorId);

    const uploaded = await this.cloudinaryService.uploadImage(
      file,
      this.moodboardImagesFolder,
    );

    // Validate tất cả productId trong productPoints nếu có
    const points = await this.buildProductPoints(dto.productPoints ?? []);

    const doc = await this.moodboardModel.create({
      authorId: new Types.ObjectId(authorId),
      authorName: dto.title ? undefined : undefined, // sẽ populate sau nếu cần
      title: dto.title,
      description: dto.description,
      imageUrl: uploaded.secureUrl,
      imagePublicId: uploaded.publicId,
      imageWidth: uploaded.width,
      imageHeight: uploaded.height,
      imageFormat: uploaded.format,
      imageBytes: uploaded.bytes,
      roomType: dto.roomType,
      tags: dto.tags ?? [],
      isPublic: dto.isPublic ?? true,
      isFeatured: dto.isFeatured ?? false,
      productPoints: points,
    });

    const populated = await this.moodboardModel
      .findById(doc._id)
      .populate('productPoints.productId', PRODUCT_FIELDS)
      .exec();
    return this.toResponse(populated ?? doc);
  }

  private async buildProductPoints(
    inputs: MoodboardProductPointInput[],
  ): Promise<Array<{ productId: Types.ObjectId; x: number; y: number }>> {
    if (!inputs.length) return [];
    const ids = inputs.map((i) => i.productId);
    const found = await this.productModel
      .find({ _id: { $in: ids } }, { _id: 1 })
      .exec();
    if (found.length !== new Set(ids).size) {
      throw new BadRequestException('Một hoặc nhiều productId không tồn tại');
    }
    return inputs.map((i) => ({
      productId: new Types.ObjectId(i.productId),
      x: i.x,
      y: i.y,
    }));
  }

  private assertObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ObjectId không hợp lệ');
    }
  }

  private mapProduct(raw: Record<string, unknown>): MoodboardProductSummary {
    return {
      _id: String(raw._id ?? ''),
      id: String(raw._id ?? ''),
      name: String(raw.name ?? ''),
      price: Number(raw.price ?? 0),
      discount: Number(raw.discount ?? 0),
      stock: Number(raw.stock ?? 0),
      images: Array.isArray(raw.images) ? (raw.images as string[]) : [],
      image: String(raw.image ?? ''),
      material: String(raw.material ?? ''),
      category: String(raw.category ?? ''),
      brand: String(raw.brand ?? ''),
      color: String(raw.color ?? ''),
      dimensions: String(raw.dimensions ?? ''),
      rating: Number(raw.rating ?? 0),
      status: String(raw.status ?? ''),
      description: String(raw.description ?? ''),
    };
  }

  private toResponse(doc: MoodboardDocument | Moodboard): MoodboardResponse {
    const data = (
      typeof (doc as MoodboardDocument).toObject === 'function'
        ? (doc as MoodboardDocument).toObject()
        : doc
    ) as MoodboardObject;
    const idStr = data.id ?? data._id?.toString();
    if (!idStr) throw new BadRequestException('Moodboard id thiếu');

    const points: MoodboardPointResponse[] = (data.productPoints ?? []).map((point) => {
      const pointAny = point as unknown as Record<string, unknown>;
      const productIdStr = (point.productId as Types.ObjectId | undefined)?.toString?.() ?? '';
      const rawProduct = point.productId as unknown as Record<string, unknown> | undefined;
      const populated =
        rawProduct && typeof rawProduct === 'object' && '_id' in rawProduct
          ? this.mapProduct(rawProduct)
          : undefined;

      return {
        _id: pointAny._id?.toString?.() ?? undefined,
        productId: populated?._id ?? productIdStr,
        x: Number(point.x ?? 0),
        y: Number(point.y ?? 0),
        product: populated,
      };
    });

    return {
      _id: idStr,
      id: idStr,
      moodboardId: idStr,
      authorId: data.authorId?.toString?.() ?? '',
      authorName: data.authorName,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      imagePublicId: data.imagePublicId,
      imageWidth: data.imageWidth,
      imageHeight: data.imageHeight,
      imageFormat: data.imageFormat,
      imageBytes: data.imageBytes,
      roomType: data.roomType,
      tags: data.tags ?? [],
      likes: data.likes ?? 0,
      views: data.views ?? 0,
      isPublic: data.isPublic ?? true,
      isFeatured: data.isFeatured ?? false,
      productPoints: points,
      productsCount: points.length,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  /** Filter chỉ dùng nội bộ — không khả dụng ngoài service. */
  buildOwnerFilter(authorId: string): FilterQuery<MoodboardDocument> {
    return {
      $or: [
        { authorId: new Types.ObjectId(authorId) },
        { $expr: { $eq: [{ $toString: '$authorId' }, authorId] } },
      ],
    } as FilterQuery<MoodboardDocument>;
  }
}
