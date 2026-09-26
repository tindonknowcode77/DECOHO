import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductFavoriteDocument = HydratedDocument<ProductFavorite>;

@Schema({ collection: 'product_favorites', timestamps: true, versionKey: false })
export class ProductFavorite {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;
}

export const ProductFavoriteSchema = SchemaFactory.createForClass(ProductFavorite);
ProductFavoriteSchema.index({ userId: 1, productId: 1 }, { unique: true });
