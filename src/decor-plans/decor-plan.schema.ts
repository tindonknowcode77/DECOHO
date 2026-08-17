import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DecorPlanDocument = HydratedDocument<DecorPlan>;

@Schema({ collection: 'decor_plans', timestamps: true, versionKey: false })
export class DecorPlan {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', index: true })
  roomId?: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  style: string;

  @Prop({ min: 0, default: 0 })
  estimatedCost: number;

  @Prop({ trim: true })
  designSuggestion?: string;

  @Prop({ type: [Types.ObjectId], ref: 'Product', default: [] })
  productIds: Types.ObjectId[];
}

export const DecorPlanSchema = SchemaFactory.createForClass(DecorPlan);
