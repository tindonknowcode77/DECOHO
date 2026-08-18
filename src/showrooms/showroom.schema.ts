import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ShowroomDocument=HydratedDocument<Showroom>;
export enum ShowroomStatus{Draft='DRAFT',Published='PUBLISHED',Hidden='HIDDEN'}

@Schema({_id:false})
export class Vector3{ @Prop({default:0}) x:number; @Prop({default:0}) y:number; @Prop({default:0}) z:number; }
const Vector3Schema=SchemaFactory.createForClass(Vector3);

@Schema({_id:true})
export class ShowroomItem{
  @Prop({type:Types.ObjectId,ref:'Product',required:true}) productId:Types.ObjectId;
  @Prop({required:true,trim:true}) modelUrl:string;
  @Prop({trim:true}) modelPublicId?:string;
  @Prop({type:Vector3Schema,default:()=>({x:0,y:0,z:0})}) position:Vector3;
  @Prop({type:Vector3Schema,default:()=>({x:0,y:0,z:0})}) rotation:Vector3;
  @Prop({type:Vector3Schema,default:()=>({x:1,y:1,z:1})}) scale:Vector3;
}
const ShowroomItemSchema=SchemaFactory.createForClass(ShowroomItem);

@Schema({collection:'showrooms',timestamps:true,versionKey:false})
export class Showroom{
  @Prop({required:true,trim:true,maxlength:160}) title:string;
  @Prop({trim:true,maxlength:1000}) description?:string;
  @Prop({trim:true}) thumbnailUrl?:string;
  @Prop({trim:true}) environmentModelUrl?:string;
  @Prop({trim:true}) environmentModelPublicId?:string;
  @Prop({type:String,enum:Object.values(ShowroomStatus),default:ShowroomStatus.Draft,index:true}) status:ShowroomStatus;
  @Prop({type:[ShowroomItemSchema],default:[]}) items:ShowroomItem[];
  @Prop({type:Types.ObjectId,ref:'User',required:true,index:true}) createdBy:Types.ObjectId;
}
export const ShowroomSchema=SchemaFactory.createForClass(Showroom);
