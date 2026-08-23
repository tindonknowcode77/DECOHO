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

export type ProductDimensions = {
  length?: string;
  width?: string;
  height?: string;
};

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

  @Prop({ trim: true, maxlength: 80 })
  sku?: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  category: string;

  @Prop({ trim: true })
  brand?: string;

  @Prop({ trim: true, maxlength: 2000 })
  description?: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ min: 0, default: 0 })
  discount: number;

  @Prop({ min: 0, default: 0 })
  stock: number;

  @Prop({ min: 0, default: 0 })
  soldCount: number;

  @Prop({ type: String, enum: Object.values(ProductStatus), default: ProductStatus.Draft, index: true })
  status: ProductStatus;

  @Prop({ default: false, index: true })
  isLocked: boolean;

  @Prop({ trim: true, maxlength: 1000 })
  moderationReason?: string;

  @Prop({ default: false, index: true })
  isFeatured: boolean;

  @Prop({ trim: true })
  material?: string;

  @Prop({ trim: true })
  color?: string;

  @Prop({ type: Object })
  dimensions?: ProductDimensions;

  @Prop({ trim: true })
  weight?: string;

  @Prop({ trim: true })
  origin?: string;

  @Prop({ trim: true })
  warranty?: string;

  @Prop({ min: 0, max: 5, default: 0 })
  rating: number;

  @Prop({ min: 0, default: 0 })
  reviews: number;

  @Prop({ trim: true })
  image: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [], index: true })
  styleTags: string[];

  @Prop({
    type: String,
    enum: Object.values(EcommercePlatform),
    required: false,
    trim: true,
  })
  ecommercePlatform?: EcommercePlatform;

  @Prop({ trim: true, maxlength: 1000 })
  productLink?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ price: 1 });
ProductSchema.index({ category: 1, price: 1 });
ProductSchema.index({ styleTags: 1, price: 1 });
ProductSchema.index({ discount: 1 });
ProductSchema.index({ rating: 1 });
ProductSchema.index({ stock: 1 });
ProductSchema.index({ soldCount: 1 });
ProductSchema.index({
  name: 'text',
  category: 'text',
  brand: 'text',
  tags: 'text',
  styleTags: 'text',
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
  if (!this.productLink) return null;
  try {
    return new URL(this.productLink).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
});

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });
