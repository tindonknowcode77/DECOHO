import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ShowroomDesignDocument = HydratedDocument<ShowroomDesign>;

@Schema({ _id: false })
export class ShowroomDesignItem {
  @Prop({ required: true, trim: true, maxlength: 120 })
  instanceId: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  productId: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  name: string;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  modelUrl: string;

  @Prop({ type: [Number], required: true, validate: [(v: number[]) => Array.isArray(v) && v.length === 3, 'Position must have 3 coordinates'] })
  position: number[];

  @Prop({ required: true, default: 0 })
  rotationY: number;

  @Prop({ required: true, default: 0.35 })
  scale: number;
}

export const ShowroomDesignItemSchema = SchemaFactory.createForClass(ShowroomDesignItem);

@Schema({ timestamps: true })
export class ShowroomDesign {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 160 })
  name: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  showroomId: string;

  @Prop({ trim: true, maxlength: 200, default: 'Phòng mẫu 3D' })
  showroomName: string;

  @Prop({ type: [ShowroomDesignItemSchema], default: [] })
  items: ShowroomDesignItem[];
}

export const ShowroomDesignSchema = SchemaFactory.createForClass(ShowroomDesign);
ShowroomDesignSchema.index({ userId: 1, updatedAt: -1 });
