import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SearchLogDocument = HydratedDocument<SearchLog>;

@Schema({ collection: 'search_logs', timestamps: true, versionKey: false })
export class SearchLog {
  @Prop({ required: true, trim: true, maxlength: 120, index: true }) query: string;
  @Prop({ required: true, trim: true, maxlength: 100, index: true }) sessionId: string;
  @Prop({ min: 0, default: 0 }) resultCount: number;
}
export const SearchLogSchema = SchemaFactory.createForClass(SearchLog);
SearchLogSchema.index({ sessionId: 1, createdAt: -1 });
SearchLogSchema.index({ query: 1, createdAt: -1 });
