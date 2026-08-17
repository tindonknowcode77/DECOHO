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
import { Room, RoomDocument, RoomType } from './room.schema';
import { Product, ProductDocument } from '../products/product.schema';

export type RoomResponse = {
  roomId: string;
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
  productPoints: Array<{ _id?: Types.ObjectId; productId: Types.ObjectId; x: number; y: number }>;
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
  ): Promise<RoomResponse> {
    this.assertValidObjectId(userId);

    const uploadedImage = await this.cloudinaryService.uploadImage(
      file,
      this.roomImagesFolder,
    );

    const room = await this.roomModel.create({
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
      .find(this.buildOwnerFilter(userId))
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
    return this.roomModel
      .find(publicOnly ? { isPublic: true } : {})
      .sort({ isFeatured: -1, createdAt: -1 })
      .populate('productPoints.productId', 'name price images status')
      .exec();
  }

  async getUserProductSpaces(userId: string) {
    this.assertValidObjectId(userId);
    return this.roomModel
      .find(this.buildOwnerFilter(userId))
      .sort({ createdAt: -1 })
      .populate('productPoints.productId', 'name price images status')
      .exec();
  }

  async getPublicProductSpace(roomId: string) {
    this.assertValidObjectId(roomId);
    const room = await this.roomModel
      .findOne({ _id: new Types.ObjectId(roomId), isPublic: true })
      .populate('productPoints.productId', 'name price images status')
      .exec();
    if (!room) throw new NotFoundException('Public Product Space not found');
    return room;
  }

  async updateProductSpace(roomId: string, dto: UpdateProductSpaceDto) {
    this.assertValidObjectId(roomId);
    if (dto.isFeatured) {
      await this.roomModel.updateMany({ _id: { $ne: new Types.ObjectId(roomId) } }, { $set: { isFeatured: false } }).exec();
    }
    const room = await this.roomModel.findByIdAndUpdate(roomId, { $set: dto }, { new: true, runValidators: true }).exec();
    if (!room) throw new NotFoundException('Product Space not found');
    return room;
  }

  async addProductPoint(roomId: string, dto: ProductPointDto) {
    this.assertValidObjectId(roomId);
    const product = await this.productModel.exists({ _id: new Types.ObjectId(dto.productId) });
    if (!product) throw new NotFoundException('Product not found');
    const room = await this.roomModel.findByIdAndUpdate(roomId, { $push: { productPoints: { productId: new Types.ObjectId(dto.productId), x: dto.x, y: dto.y } } }, { new: true, runValidators: true }).exec();
    if (!room) throw new NotFoundException('Product Space not found');
    return room;
  }

  async updateProductPoint(roomId: string, pointId: string, dto: ProductPointDto) {
    this.assertValidObjectId(roomId); this.assertValidObjectId(pointId);
    const product = await this.productModel.exists({ _id: new Types.ObjectId(dto.productId) });
    if (!product) throw new NotFoundException('Product not found');
    const room = await this.roomModel.findOneAndUpdate(
      { _id: new Types.ObjectId(roomId), 'productPoints._id': new Types.ObjectId(pointId) },
      { $set: { 'productPoints.$.productId': new Types.ObjectId(dto.productId), 'productPoints.$.x': dto.x, 'productPoints.$.y': dto.y } },
      { new: true, runValidators: true },
    ).exec();
    if (!room) throw new NotFoundException('Product Space or product point not found');
    return room;
  }

  async deleteProductPoint(roomId: string, pointId: string) {
    this.assertValidObjectId(roomId); this.assertValidObjectId(pointId);
    const room = await this.roomModel.findOneAndUpdate(
      { _id: new Types.ObjectId(roomId), 'productPoints._id': new Types.ObjectId(pointId) },
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
    const roomId = data.id ?? data._id?.toString();

    if (!roomId) {
      throw new BadRequestException('Room id is missing');
    }

    return {
      roomId,
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
      productPoints: data.productPoints ?? [],
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
