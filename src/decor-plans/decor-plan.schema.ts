import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DecorPlanDocument = HydratedDocument<DecorPlan>;

export enum DecorStyle {
  Minimalist = 'Minimalist',
  Modern = 'Modern',
  Vintage = 'Vintage',
  Luxury = 'Luxury',
  Korean = 'Korean',
}

@Schema({ _id: false })
export class RecommendedProduct {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, trim: true })
  image: string;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, trim: true })
  ecommercePlatform: string;

  @Prop({ required: true, trim: true })
  productLink: string;

  @Prop({ type: [String], default: [] })
  styleTags: string[];
}

export const RecommendedProductSchema =
  SchemaFactory.createForClass(RecommendedProduct);

@Schema({ _id: false })
export class RoomAnalysisSnapshot {
  @Prop({ required: true, trim: true })
  roomType: string;

  @Prop({ type: [String], default: [] })
  detectedObjects: string[];

  @Prop({ type: [String], default: [] })
  colors: string[];
}

export const RoomAnalysisSnapshotSchema =
  SchemaFactory.createForClass(RoomAnalysisSnapshot);

@Schema({
  collection: 'decor_plans',
  timestamps: true,
  versionKey: false,
})
export class DecorPlan {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  budget: number;

  @Prop({ type: String, enum: Object.values(DecorStyle), required: true })
  style: DecorStyle;

  @Prop({ required: true, min: 0 })
  estimatedCost: number;

  @Prop({ required: true, trim: true })
  designSuggestion: string;

  @Prop({ type: [RecommendedProductSchema], default: [] })
  recommendedProducts: RecommendedProduct[];

  @Prop({ type: RoomAnalysisSnapshotSchema, required: true })
  analysis: RoomAnalysisSnapshot;
}

export const DecorPlanSchema = SchemaFactory.createForClass(DecorPlan);

DecorPlanSchema.index({ userId: 1, createdAt: -1 });
DecorPlanSchema.index({ roomId: 1, createdAt: -1 });
DecorPlanSchema.index({ style: 1, estimatedCost: 1 });
