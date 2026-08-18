import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ collection: 'categories', timestamps: true, versionKey: false })
export class Category {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, unique: true, index: true })
  slug: string;

  @Prop({ type: Types.ObjectId, ref: Category.name, default: null, index: true })
  parentId?: Types.ObjectId | null;

  @Prop({ trim: true, maxlength: 1000 })
  imageUrl?: string;

  @Prop({ trim: true })
  imagePublicId?: string;

  @Prop({ min: 0, default: 0, index: true })
  displayOrder: number;

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ parentId: 1, displayOrder: 1, name: 1 });
