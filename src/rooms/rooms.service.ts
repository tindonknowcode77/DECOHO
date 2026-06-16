import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room, RoomDocument } from './room.schema';

@Injectable()
export class RoomsService {
  private readonly roomImagesFolder =
    process.env.CLOUDINARY_ROOMS_FOLDER ??
    `${process.env.CLOUDINARY_FOLDER ?? 'decoho'}/rooms`;

  constructor(
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async uploadRoom(
    userId: string,
    createRoomDto: CreateRoomDto,
    file: Express.Multer.File,
  ): Promise<Room> {
    this.assertValidObjectId(userId);

    const uploadedImage = await this.cloudinaryService.uploadImage(
      file,
      this.roomImagesFolder,
    );

    const room = await this.roomModel.create({
      ...createRoomDto,
      userId: new Types.ObjectId(userId),
      imageUrl: uploadedImage.secureUrl,
    });

    return room;
  }

  async getMyRooms(userId: string): Promise<Room[]> {
    this.assertValidObjectId(userId);

    return this.roomModel
      .find({
        userId,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getRoomById(userId: string, roomId: string): Promise<Room> {
    this.assertValidObjectId(userId);
    this.assertValidObjectId(roomId);

    return this.findOwnedRoom(userId, roomId);
  }

  async deleteRoom(userId: string, roomId: string): Promise<void> {
    this.assertValidObjectId(userId);
    this.assertValidObjectId(roomId);

    const result = await this.roomModel
      .deleteOne({
        _id: roomId,
        userId,
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Room not found');
    }
  }

  private async findOwnedRoom(
    userId: string,
    roomId: string,
  ): Promise<RoomDocument> {
    const room = await this.roomModel
      .findOne({
        _id: roomId,
        userId,
      })
      .exec();

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  private assertValidObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid object id');
    }
  }
}
