import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RoomDocument = HydratedDocument<Room>;

export enum RoomType {
  Bedroom = 'bedroom',
  LivingRoom = 'living_room',
  Kitchen = 'kitchen',
  Bathroom = 'bathroom',
  Office = 'office',
  DiningRoom = 'dining_room',
  Other = 'other',
}

@Schema({ _id: true, versionKey: false })
export class ProductPoint {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 100 })
  x: number;

  @Prop({ required: true, min: 0, max: 100 })
  y: number;
}

export const ProductPointSchema = SchemaFactory.createForClass(ProductPoint);

@Schema({
  collection: 'rooms',
  timestamps: true,
  versionKey: false,
})
export class Room {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  imageUrl: string;

  @Prop({ trim: true })
  imagePublicId?: string;

  @Prop({ min: 0 })
  imageWidth?: number;

  @Prop({ min: 0 })
  imageHeight?: number;

  @Prop({ trim: true })
  imageFormat?: string;

  @Prop({ min: 0 })
  imageBytes?: number;

  @Prop({ type: String, enum: Object.values(RoomType), required: true })
  roomType: RoomType;

  @Prop({ required: true, min: 0 })
  width: number;

  @Prop({ required: true, min: 0 })
  length: number;

  @Prop({ trim: true, maxlength: 160 })
  title?: string;

  @Prop({ trim: true, maxlength: 1000 })
  description?: string;

  @Prop({ default: false, index: true })
  isPublic: boolean;

  @Prop({ default: false, index: true })
  isFeatured: boolean;

  @Prop({ type: [ProductPointSchema], default: [] })
  productPoints: ProductPoint[];
}

export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.index({ userId: 1, createdAt: -1 });
RoomSchema.index({ userId: 1, roomType: 1 });

RoomSchema.virtual('roomId').get(function () {
  return this._id?.toString();
});

RoomSchema.set('toJSON', { virtuals: true });
RoomSchema.set('toObject', { virtuals: true });
