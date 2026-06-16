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

  @Prop({ type: String, enum: Object.values(RoomType), required: true })
  roomType: RoomType;

  @Prop({ required: true, min: 0 })
  width: number;

  @Prop({ required: true, min: 0 })
  length: number;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.index({ userId: 1, createdAt: -1 });
RoomSchema.index({ userId: 1, roomType: 1 });
