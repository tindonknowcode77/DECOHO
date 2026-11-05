import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AffiliateClickDocument = AffiliateClick & Document;

@Schema({ timestamps: true, collection: 'affiliate_clicks' })
export class AffiliateClick {
  @Prop({ required: true, unique: true, index: true, trim: true })
  clickId: string;

  @Prop({ required: true, type: Date, index: true })
  clickTime: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId: Types.ObjectId | null;

  @Prop({ trim: true, default: '' })
  subId: string;

  @Prop({ trim: true, default: '' })
  referrer: string;

  @Prop({ trim: true, default: '' })
  clickRegion: string;
}

export const AffiliateClickSchema = SchemaFactory.createForClass(AffiliateClick);

