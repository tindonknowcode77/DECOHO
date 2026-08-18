import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
export type ReviewDocument=HydratedDocument<Review>;
export enum ReviewStatus{Visible='VISIBLE',Hidden='HIDDEN',SpamDeleted='SPAM_DELETED'}
@Schema({_id:true})
export class ReviewReport{
  @Prop({type:Types.ObjectId,ref:'User',required:true}) userId:Types.ObjectId;
  @Prop({required:true,trim:true,maxlength:500}) reason:string;
  @Prop({default:Date.now}) createdAt:Date;
  @Prop({default:false}) resolved:boolean;
  @Prop({trim:true,maxlength:500}) resolution?:string;
}
const ReviewReportSchema=SchemaFactory.createForClass(ReviewReport);
@Schema({collection:'reviews',timestamps:true,versionKey:false})
export class Review{
  @Prop({type:Types.ObjectId,ref:'User',required:true,index:true}) userId:Types.ObjectId;
  @Prop({type:Types.ObjectId,ref:'Product',required:true,index:true}) productId:Types.ObjectId;
  @Prop({type:Types.ObjectId,ref:'User',required:true,index:true}) supplierId:Types.ObjectId;
  @Prop({type:Types.ObjectId,ref:'Order'}) orderId?:Types.ObjectId;
  @Prop({required:true,min:1,max:5,index:true}) rating:number;
  @Prop({required:true,trim:true,maxlength:3000}) content:string;
  @Prop({type:[String],default:[]}) images:string[];
  @Prop({default:false}) verifiedPurchase:boolean;
  @Prop({type:String,enum:Object.values(ReviewStatus),default:ReviewStatus.Visible,index:true}) status:ReviewStatus;
  @Prop({type:[ReviewReportSchema],default:[]}) reports:ReviewReport[];
  @Prop({type:Types.ObjectId,ref:'User'}) moderatedBy?:Types.ObjectId;
  @Prop() moderatedAt?:Date;
  @Prop({trim:true,maxlength:1000}) moderationReason?:string;
}
export const ReviewSchema=SchemaFactory.createForClass(Review);
ReviewSchema.index({productId:1,createdAt:-1});ReviewSchema.index({supplierId:1,createdAt:-1});
