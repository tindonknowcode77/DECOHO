import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FavoriteDocument = HydratedDocument<Favorite>;

@Schema({
  collection: 'favorites',
  timestamps: true,
  versionKey: false,
})
export class Favorite {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'DecorPlan',
    required: true,
    index: true,
  })
  decorPlanId: Types.ObjectId;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

FavoriteSchema.index({ userId: 1, createdAt: -1 });
FavoriteSchema.index({ userId: 1, decorPlanId: 1 }, { unique: true });
