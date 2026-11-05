import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AffiliateOrderDocument = AffiliateOrder & Document;

@Schema({ timestamps: true, collection: 'affiliate_orders' })
export class AffiliateOrder {
  @Prop({ required: true, index: true, trim: true })
  orderId: string;

  @Prop({ required: true, unique: true, index: true, trim: true })
  conversionId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId: Types.ObjectId | null;

  @Prop({ trim: true, default: '' })
  subId1: string;

  @Prop({ trim: true, default: '' })
  subId2: string;

  @Prop({ trim: true, default: '' })
  subId3: string;

  @Prop({ trim: true, default: '' })
  subId4: string;

  @Prop({ trim: true, default: '' })
  subId5: string;

  @Prop({ required: true, trim: true })
  itemName: string;

  @Prop({ trim: true, default: '' })
  shopName: string;

  @Prop({ required: true, trim: true, default: 'Pending', index: true })
  orderStatus: string;

  @Prop({ type: Date, required: true, index: true })
  orderTime: Date;

  @Prop({ type: Date, default: null })
  clickTime: Date | null;

  @Prop({ type: Number, required: true, default: 0 })
  purchaseValue: number;

  @Prop({ type: Number, required: true, default: 0 })
  commission: number;

  @Prop({ type: Boolean, default: false, index: true })
  isClaimed: boolean;

  @Prop({ type: Date, default: null })
  claimedAt: Date | null;
}

export const AffiliateOrderSchema = SchemaFactory.createForClass(AffiliateOrder);
AffiliateOrderSchema.index({ userId: 1, orderTime: -1 });
AffiliateOrderSchema.index({ orderStatus: 1, orderTime: -1 });

