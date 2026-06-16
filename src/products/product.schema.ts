import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({
  collection: 'products',
  timestamps: true,
  versionKey: false,
})
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, trim: true })
  image: string;

  @Prop({ type: [String], required: true, default: [], index: true })
  styleTags: string[];

  @Prop({ required: true, trim: true, index: true })
  category: string;

  @Prop({ required: true, trim: true, index: true })
  ecommercePlatform: string;

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
