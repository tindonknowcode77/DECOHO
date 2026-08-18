import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PromotionDocument = HydratedDocument<Promotion>;
export enum DiscountType { Percentage = 'percentage', Fixed = 'fixed' }

@Schema({ collection: 'promotions', timestamps: true, versionKey: false })
export class Promotion {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true }) code: string;
  @Prop({ enum: Object.values(DiscountType), required: true }) discountType: DiscountType;
  @Prop({ required: true, min: 0 }) discountValue: number;
  @Prop({ required: true, index: true }) startDate: Date;
  @Prop({ required: true, index: true }) endDate: Date;
  @Prop({ required: true, min: 1 }) usageLimit: number;
  @Prop({ min: 0, default: 0 }) usageCount: number;
  @Prop({ min: 0, default: 0 }) minimumOrderAmount: number;
  @Prop({ min: 0 }) maximumDiscountAmount?: number;
  @Prop({ type: [Types.ObjectId], ref: 'Product', default: [] }) productIds: Types.ObjectId[];
  @Prop({ type: [Types.ObjectId], ref: 'Category', default: [] }) categoryIds: Types.ObjectId[];
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] }) supplierIds: Types.ObjectId[];
  @Prop({ default: true, index: true }) isActive: boolean;
  @Prop({ maxlength: 500 }) description?: string;
}
export const PromotionSchema = SchemaFactory.createForClass(Promotion);
PromotionSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
