import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BrandDocument = HydratedDocument<Brand>;

@Schema({ collection: 'brands', timestamps: true, versionKey: false })
export class Brand {
  @Prop({ required: true, trim: true, maxlength: 160 })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  slug: string;

  @Prop({ trim: true, maxlength: 1000 })
  logoUrl?: string;

  @Prop({ trim: true, maxlength: 1000 })
  description?: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [], index: true })
  supplierIds: Types.ObjectId[];

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);
BrandSchema.index({ name: 1 });
