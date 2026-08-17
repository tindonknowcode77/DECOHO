import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';import { HydratedDocument, Types } from 'mongoose';
export type SupportTicketDocument=HydratedDocument<SupportTicket>;
export enum TicketStatus{Open='OPEN',InProgress='IN_PROGRESS',Resolved='RESOLVED',Closed='CLOSED'}
export enum TicketPriority{Low='LOW',Normal='NORMAL',High='HIGH',Urgent='URGENT'}
export enum TicketType{Support='SUPPORT',OrderComplaint='ORDER_COMPLAINT',Dispute='DISPUTE'}
@Schema({_id:true})export class TicketMessage{@Prop({type:Types.ObjectId,ref:'User',required:true})senderId:Types.ObjectId;@Prop({required:true,trim:true,maxlength:5000})content:string;@Prop({type:[String],default:[]})attachments:string[];@Prop({default:Date.now})createdAt:Date;}
const TicketMessageSchema=SchemaFactory.createForClass(TicketMessage);
@Schema({_id:false})export class TicketEvent{@Prop({required:true,enum:Object.values(TicketStatus)})status:TicketStatus;@Prop({type:Types.ObjectId,ref:'User'})changedBy?:Types.ObjectId;@Prop({default:Date.now})at:Date;@Prop({trim:true,maxlength:1000})note?:string;}
const TicketEventSchema=SchemaFactory.createForClass(TicketEvent);
@Schema({collection:'support_tickets',timestamps:true,versionKey:false})export class SupportTicket{
@Prop({required:true,unique:true,index:true})ticketCode:string;@Prop({required:true,trim:true,maxlength:200})title:string;@Prop({type:String,enum:Object.values(TicketType),default:TicketType.Support,index:true})type:TicketType;@Prop({type:String,enum:Object.values(TicketStatus),default:TicketStatus.Open,index:true})status:TicketStatus;@Prop({type:String,enum:Object.values(TicketPriority),default:TicketPriority.Normal,index:true})priority:TicketPriority;
@Prop({type:Types.ObjectId,ref:'User',required:true,index:true})customerId:Types.ObjectId;@Prop({type:Types.ObjectId,ref:'User',index:true})supplierId?:Types.ObjectId;@Prop({type:Types.ObjectId,ref:'User',index:true})assignedStaffId?:Types.ObjectId;@Prop({type:Types.ObjectId,ref:'Order',index:true})orderId?:Types.ObjectId;
@Prop({type:[TicketMessageSchema],default:[]})messages:TicketMessage[];@Prop({type:[TicketEventSchema],default:[]})statusHistory:TicketEvent[];@Prop()resolvedAt?:Date;@Prop()closedAt?:Date;}
export const SupportTicketSchema=SchemaFactory.createForClass(SupportTicket);SupportTicketSchema.index({createdAt:-1,status:1});
