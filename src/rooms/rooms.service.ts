import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { ProductPointDto } from './dto/product-point.dto';
import { UpdateProductSpaceDto } from './dto/update-product-space.dto';
import {
  ROOM_KIND_MOODBOARD,
  ROOM_KIND_ROOM,
  Room,
  RoomDocument,
  RoomKindType,
  RoomType,
} from './room.schema';
import { Product, ProductDocument } from '../products/product.schema';

export type RoomResponse = {
  _id?: string;
  id?: string;
  roomId: string;
  kind: RoomKindType;
  userId: string;
  imageUrl: string;
  imagePublicId?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageFormat?: string;
  imageBytes?: number;
  roomType: RoomType;
  width: number;
  length: number;
  title?: string;
  description?: string;
  isPublic: boolean;
  isFeatured: boolean;
  productPoints: Array<{
    _id?: string;
    productId: string;
    x: number;
    y: number;
    product?: {
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
  }>;
  createdAt?: Date;
  updatedAt?: Date;
};

type RoomObject = Room & {
  _id?: Types.ObjectId | { toString(): string };
  id?: string;
  userId: Types.ObjectId | string | { toString(): string };
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class RoomsService {
  private readonly roomImagesFolder =
    process.env.CLOUDINARY_ROOMS_FOLDER ??
    `${process.env.CLOUDINARY_FOLDER ?? 'decoho'}/rooms`;

  constructor(
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async uploadRoom(
    userId: string,
    createRoomDto: CreateRoomDto,
    file: Express.Multer.File,
    kind: RoomKindType = ROOM_KIND_ROOM,
  ): Promise<RoomResponse> {
    this.assertValidObjectId(userId);

    const uploadedImage = await this.cloudinaryService.uploadImage(
      file,
      this.roomImagesFolder,
    );

    const room = await this.roomModel.create({
      kind,
      ...createRoomDto,
      userId: new Types.ObjectId(userId),
      imageUrl: uploadedImage.secureUrl,
      imagePublicId: uploadedImage.publicId,
      imageWidth: uploadedImage.width,
      imageHeight: uploadedImage.height,
      imageFormat: uploadedImage.format,
      imageBytes: uploadedImage.bytes,
    });

    return this.toRoomResponse(room);
  }

  async getMyRooms(userId: string): Promise<RoomResponse[]> {
    this.assertValidObjectId(userId);

    const rooms = await this.roomModel
      .find({ ...this.buildOwnerFilter(userId), kind: ROOM_KIND_ROOM })
      .sort({ createdAt: -1 })
      .exec();

    return rooms.map((room) => this.toRoomResponse(room));
  }

  async getRoomById(userId: string, roomId: string): Promise<RoomResponse> {
    this.assertValidObjectId(userId);
    this.assertValidObjectId(roomId);

    const room = await this.findOwnedRoom(userId, roomId);

    return this.toRoomResponse(room);
  }

  async deleteRoom(userId: string, roomId: string): Promise<void> {
    this.assertValidObjectId(userId);
    this.assertValidObjectId(roomId);

    const room = await this.findOwnedRoom(userId, roomId);
    const result = await this.roomModel
      .deleteOne({
        _id: room._id,
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Room not found');
    }

    if (room.imagePublicId) {
      try {
        await this.cloudinaryService.deleteImage(room.imagePublicId);
      } catch {
        // Cloudinary cleanup is best effort; MongoDB ownership deletion already succeeded.
      }
    }
  }

  async getProductSpaces(publicOnly = false) {
    return this.readProductSpaces(
      { kind: ROOM_KIND_MOODBOARD, ...(publicOnly ? { isPublic: true } : {}) },
      { isFeatured: -1, createdAt: -1 },
    );
  }

  async getUserProductSpaces(userId: string) {
    this.assertValidObjectId(userId);
    return this.readProductSpaces(
      { ...this.buildOwnerFilter(userId), kind: ROOM_KIND_MOODBOARD },
      { createdAt: -1 },
    );
  }

  async getPublicProductSpace(roomId: string) {
    if (!roomId || roomId.length > 128) {
      throw new BadRequestException('Invalid moodboard id');
    }
    const ids: Array<string | Types.ObjectId> = [roomId];
    if (Types.ObjectId.isValid(roomId)) ids.push(new Types.ObjectId(roomId));
    const [room] = await this.readProductSpaces(
      { _id: { $in: ids }, kind: ROOM_KIND_MOODBOARD, isPublic: true },
      { createdAt: -1 },
    );
    if (!room) throw new NotFoundException('Public Product Space not found');
    return room;
  }

  private async readProductSpaces(
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
  ) {
    // Imported boards can have string IDs. Aggregation preserves those IDs
    // instead of hydrating them through the ObjectId schema.
    const rooms = await this.roomModel.aggregate([
      { $match: filter },
      { $sort: sort },
    ]).exec();
    const populateOptions = {
      path: 'productPoints.productId',
      select: 'name price discount stock images image material category brand color dimensions rating status description',
      // Broken legacy references must not prevent the whole gallery loading.
      skipInvalidIds: true,
    };
    return this.roomModel.populate(rooms, populateOptions);
  }

  async updateProductSpace(roomId: string, dto: UpdateProductSpaceDto) {
    this.assertValidObjectId(roomId);
    if (dto.isFeatured) {
      await this.roomModel.updateMany(
        { _id: { $ne: new Types.ObjectId(roomId) }, kind: ROOM_KIND_MOODBOARD },
        { $set: { isFeatured: false } },
      ).exec();
    }
    const room = await this.roomModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(roomId), kind: ROOM_KIND_MOODBOARD },
        { $set: dto },
        { new: true, runValidators: true },
      )
      .exec();
    if (!room) throw new NotFoundException('Product Space not found');
    return room;
  }

  async updateProductSpaceImage(roomId: string, file: Express.Multer.File) {
    if (!roomId || roomId.length > 128) throw new BadRequestException('Invalid moodboard id');
    const ids: Array<string | Types.ObjectId> = [roomId];
    if (Types.ObjectId.isValid(roomId)) ids.push(new Types.ObjectId(roomId));
    // Preserve legacy string IDs and do not hydrate imported product references.
    const [room] = await this.roomModel.aggregate([
      { $match: { _id: { $in: ids }, kind: ROOM_KIND_MOODBOARD } },
      { $limit: 1 },
    ]).exec();
    if (!room) throw new NotFoundException('Product Space not found');
    const uploaded = await this.cloudinaryService.uploadImage(file, this.roomImagesFolder);
    const result = await this.roomModel.collection.updateOne(
      { _id: room._id, kind: ROOM_KIND_MOODBOARD },
      { $set: {
        imageUrl: uploaded.secureUrl,
        imagePublicId: uploaded.publicId,
        imageWidth: uploaded.width,
        imageHeight: uploaded.height,
        imageFormat: uploaded.format,
        imageBytes: uploaded.bytes,
        updatedAt: new Date(),
      } },
    );
    if (!result.matchedCount) throw new NotFoundException('Product Space not found');
    const [updated] = await this.readProductSpaces({ _id: room._id, kind: ROOM_KIND_MOODBOARD }, { createdAt: -1 });
    if (!updated) throw new NotFoundException('Product Space not found');
    return updated;
  }

  async addProductPoint(roomId: string, dto: ProductPointDto) {
    this.assertValidObjectId(roomId);
    const product = await this.productModel.exists({ _id: new Types.ObjectId(dto.productId) });
    if (!product) throw new NotFoundException('Product not found');
    const room = await this.roomModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(roomId), kind: ROOM_KIND_MOODBOARD },
        { $push: { productPoints: { productId: new Types.ObjectId(dto.productId), x: dto.x, y: dto.y } } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!room) throw new NotFoundException('Product Space not found');
    return room;
  }

  async updateProductPoint(roomId: string, pointId: string, dto: ProductPointDto) {
    this.assertValidObjectId(roomId); this.assertValidObjectId(pointId);
    const product = await this.productModel.exists({ _id: new Types.ObjectId(dto.productId) });
    if (!product) throw new NotFoundException('Product not found');
    const room = await this.roomModel.findOneAndUpdate(
      { _id: new Types.ObjectId(roomId), kind: ROOM_KIND_MOODBOARD, 'productPoints._id': new Types.ObjectId(pointId) },
      { $set: { 'productPoints.$.productId': new Types.ObjectId(dto.productId), 'productPoints.$.x': dto.x, 'productPoints.$.y': dto.y } },
      { new: true, runValidators: true },
    ).exec();
    if (!room) throw new NotFoundException('Product Space or product point not found');
    return room;
  }

  async deleteProductPoint(roomId: string, pointId: string) {
    this.assertValidObjectId(roomId); this.assertValidObjectId(pointId);
    const room = await this.roomModel.findOneAndUpdate(
      { _id: new Types.ObjectId(roomId), kind: ROOM_KIND_MOODBOARD, 'productPoints._id': new Types.ObjectId(pointId) },
      { $pull: { productPoints: { _id: new Types.ObjectId(pointId) } } },
      { new: true },
    ).exec();
    if (!room) throw new NotFoundException('Product Space or product point not found');
    return room;
  }

  private async findOwnedRoom(
    userId: string,
    roomId: string,
  ): Promise<RoomDocument> {
    const room = await this.roomModel
      .findOne({
        _id: new Types.ObjectId(roomId),
        ...this.buildOwnerFilter(userId),
      })
      .exec();

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  private buildOwnerFilter(userId: string): FilterQuery<RoomDocument> {
    return {
      $or: [
        { userId: new Types.ObjectId(userId) },
        {
          $expr: {
            $eq: [{ $toString: '$userId' }, userId],
          },
        },
      ],
    } as FilterQuery<RoomDocument>;
  }

  private toRoomResponse(room: RoomDocument): RoomResponse {
    const data = room.toObject() as RoomObject;
    const idStr = data.id ?? data._id?.toString();

    if (!idStr) {
      throw new BadRequestException('Room id is missing');
    }

    const mappedPoints: RoomResponse['productPoints'] = (data.productPoints ?? []).map((point) => {
      const pointAny = point as unknown as Record<string, unknown>;
      const productIdStr = point.productId?.toString();
      const rawProduct = pointAny.productId as Record<string, unknown> | undefined;
      const populated = typeof rawProduct === 'object' && rawProduct !== null
        ? {
            _id: String(rawProduct._id ?? ''),
            id: String(rawProduct._id ?? ''),
            name: String(rawProduct.name ?? ''),
            price: Number(rawProduct.price ?? 0),
            discount: Number(rawProduct.discount ?? 0),
            stock: Number(rawProduct.stock ?? 0),
            images: Array.isArray(rawProduct.images) ? (rawProduct.images as string[]) : [],
            image: String(rawProduct.image ?? ''),
            material: String(rawProduct.material ?? ''),
            category: String(rawProduct.category ?? ''),
            brand: String(rawProduct.brand ?? ''),
            color: String(rawProduct.color ?? ''),
            dimensions: String(rawProduct.dimensions ?? ''),
            rating: Number(rawProduct.rating ?? 0),
            status: String(rawProduct.status ?? ''),
            description: String(rawProduct.description ?? ''),
          }
        : undefined;

      return {
        _id: pointAny._id?.toString?.() ?? undefined,
        productId: productIdStr,
        x: point.x,
        y: point.y,
        product: populated,
      };
    });

    return {
      _id: idStr,
      id: idStr,
      roomId: idStr,
      kind: data.kind ?? ROOM_KIND_ROOM,
      userId: data.userId.toString(),
      imageUrl: data.imageUrl,
      imagePublicId: data.imagePublicId,
      imageWidth: data.imageWidth,
      imageHeight: data.imageHeight,
      imageFormat: data.imageFormat,
      imageBytes: data.imageBytes,
      roomType: data.roomType,
      width: data.width,
      length: data.length,
      title: data.title,
      description: data.description,
      isPublic: data.isPublic ?? false,
      isFeatured: data.isFeatured ?? false,
      productPoints: mappedPoints,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private assertValidObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid object id');
    }
  }
}
