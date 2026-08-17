import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

export enum EcommercePlatform {
  Shopee = 'Shopee',
  Lazada = 'Lazada',
  Tiki = 'Tiki',
  Sendo = 'Sendo',
  Amazon = 'Amazon',
  Ikea = 'IKEA',
  Other = 'Other',
}

export enum ProductStatus {
  Draft = 'DRAFT',
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Hidden = 'HIDDEN',
  OutOfStock = 'OUT_OF_STOCK',
}

@Schema({
  collection: 'products',
  timestamps: true,
  versionKey: false,
})
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Brand', index: true })
  brandId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', index: true })
  categoryId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  supplierId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ min: 0, default: 0, index: true })
  stock: number;

  @Prop({ min: 0, default: 0, index: true })
  soldCount: number;

  @Prop({ type: String, enum: Object.values(ProductStatus), default: ProductStatus.Draft, index: true })
  status: ProductStatus;

  @Prop({ default: false, index: true })
  isLocked: boolean;

  @Prop({ trim: true, maxlength: 1000 })
  moderationReason?: string;

  @Prop({ default: false, index: true })
  isFeatured: boolean;

  @Prop({ min: 0, max: 100, default: 0 })
  discountPercent: number;

  @Prop({ min: 0 })
  salePrice?: number;

  @Prop()
  reviewedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  image: string;

  @Prop({ type: [String], required: true, default: [], index: true })
  styleTags: string[];

  @Prop({ required: true, trim: true, index: true })
  category: string;

  @Prop({
    type: String,
    enum: Object.values(EcommercePlatform),
    required: true,
    trim: true,
    index: true,
  })
  ecommercePlatform: EcommercePlatform;

  @Prop({ required: true, trim: true })
  productLink: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ price: 1 });
ProductSchema.index({ category: 1, price: 1 });
ProductSchema.index({ styleTags: 1, price: 1 });
ProductSchema.index({
  name: 'text',
  category: 'text',
  styleTags: 'text',
  ecommercePlatform: 'text',
});

ProductSchema.virtual('productId').get(function () {
  return this._id?.toString();
});

ProductSchema.virtual('externalUrl').get(function () {
  return this.productLink;
});

ProductSchema.virtual('redirectUrl').get(function () {
  const apiPrefix = process.env.API_PREFIX ?? 'api';
  return `/${apiPrefix}/products/${this._id?.toString()}/redirect`;
});

ProductSchema.virtual('sourceDomain').get(function () {
  try {
    return new URL(this.productLink).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
});

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });
