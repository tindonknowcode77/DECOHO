import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommunityPostDocument = HydratedDocument<CommunityPost>;
@Schema({ _id: true, timestamps: true })
export class CommunityComment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ required: true, trim: true, maxlength: 1000 }) content: string;
}
const CommunityCommentSchema = SchemaFactory.createForClass(CommunityComment);

@Schema({ collection: 'community_posts', timestamps: true, versionKey: false })
export class CommunityPost {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, trim: true, maxlength: 3000 }) description: string;
  @Prop({ required: true, trim: true, maxlength: 60, index: true }) roomType: string;
  @Prop({ type: [String], default: [] }) hashtags: string[];
  @Prop({ required: true }) beforeImageUrl: string;
  @Prop({ required: true }) afterImageUrl: string;
  @Prop() beforeImagePublicId?: string;
  @Prop() afterImagePublicId?: string;
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] }) likedBy: Types.ObjectId[];
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] }) savedBy: Types.ObjectId[];
  @Prop({ type: [CommunityCommentSchema], default: [] }) comments: CommunityComment[];
  @Prop({ default: true, index: true }) isPublished: boolean;
}
export const CommunityPostSchema = SchemaFactory.createForClass(CommunityPost);
CommunityPostSchema.index({ createdAt: -1, roomType: 1 });

export type CommunityFollowDocument = HydratedDocument<CommunityFollow>;
@Schema({ collection: 'community_follows', timestamps: true, versionKey: false })
export class CommunityFollow {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) followerId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) followingId: Types.ObjectId;
}
export const CommunityFollowSchema = SchemaFactory.createForClass(CommunityFollow);
CommunityFollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
