import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MoodboardDocument = HydratedDocument<Moodboard>;

/**
 * Phân loại phòng — giống RoomType cũ nhưng tách ra để Moodboard độc lập với `rooms` collection.
 */
export enum MoodboardRoomType {
  Bedroom = 'bedroom',
  LivingRoom = 'living_room',
  Kitchen = 'kitchen',
  Bathroom = 'bathroom',
  Office = 'office',
  DiningRoom = 'dining_room',
  Other = 'other',
}

@Schema({ _id: true, versionKey: false })
export class MoodboardProductPoint {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 100 })
  x: number;

  @Prop({ required: true, min: 0, max: 100 })
  y: number;
}

export const MoodboardProductPointSchema = SchemaFactory.createForClass(MoodboardProductPoint);

/**
 * Moodboard — Product Space CÔNG KHAI, lưu trong collection `moodboards` (tách hẳn khỏi `rooms`).
 *
 * - public      : ai cũng xem được
 * - userCreated : do user upload (nếu ENABLE_USER_MOODBOARD_CREATION=true)
 * - adminCreated: do admin tạo để showcase
 *
 * Mỗi moodboard có danh sách `productPoints` — các sản phẩm trong `Product` collection
 * được ghim vào 1 toạ độ (x,y ∈ [0,100]) trên ảnh moodboard.
 */
@Schema({
  collection: 'moodboards',
  timestamps: true,
  versionKey: false,
})
export class Moodboard {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId: Types.ObjectId;

  @Prop({ trim: true, maxlength: 80 })
  authorName?: string;

  @Prop({ trim: true, maxlength: 160 })
  title?: string;

  @Prop({ trim: true, maxlength: 1000 })
  description?: string;

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

  @Prop({
    type: String,
    enum: Object.values(MoodboardRoomType),
    required: true,
    index: true,
  })
  roomType: MoodboardRoomType;

  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  @Prop({ default: 0, min: 0 })
  likes: number;

  @Prop({ default: 0, min: 0 })
  views: number;

  @Prop({ default: true, index: true })
  isPublic: boolean;

  @Prop({ default: false, index: true })
  isFeatured: boolean;

  @Prop({ type: [MoodboardProductPointSchema], default: [] })
  productPoints: MoodboardProductPoint[];
}

export const MoodboardSchema = SchemaFactory.createForClass(Moodboard);

MoodboardSchema.index({ createdAt: -1 });
MoodboardSchema.index({ isFeatured: -1, createdAt: -1 });
MoodboardSchema.index({ roomType: 1, createdAt: -1 });
MoodboardSchema.index({ tags: 1, createdAt: -1 });

MoodboardSchema.virtual('moodboardId').get(function () {
  return this._id?.toString();
});

MoodboardSchema.set('toJSON', { virtuals: true });
MoodboardSchema.set('toObject', { virtuals: true });
