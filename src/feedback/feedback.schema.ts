import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FeedbackDocument = HydratedDocument<Feedback>;

export enum FeedbackType {
  WEBSITE = 'WEBSITE',
  PRODUCT = 'PRODUCT',
  FEATURE = 'FEATURE',
  BUG = 'BUG',
}

export enum FeedbackStatus {
  NEW = 'NEW',
  REVIEWED = 'REVIEWED',
  ARCHIVED = 'ARCHIVED',
}

@Schema({ collection: 'feedbacks', timestamps: true, versionKey: false })
export class Feedback {
  @Prop({
    type: String,
    enum: Object.values(FeedbackType),
    default: FeedbackType.WEBSITE,
    index: true,
  })
  type: FeedbackType;

  @Prop({ required: true, min: 1, max: 5, index: true })
  rating: number;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  content: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Types.ObjectId, ref: 'Product', index: true })
  productId?: Types.ObjectId;

  @Prop({ trim: true })
  productName?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ trim: true })
  userName?: string;

  @Prop({ trim: true })
  userEmail?: string;

  @Prop({ trim: true })
  pageUrl?: string;

  @Prop({
    type: String,
    enum: Object.values(FeedbackStatus),
    default: FeedbackStatus.NEW,
    index: true,
  })
  status: FeedbackStatus;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
FeedbackSchema.index({ type: 1, createdAt: -1 });
FeedbackSchema.index({ productId: 1, createdAt: -1 });
