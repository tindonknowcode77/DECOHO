import { IsArray, IsEnum, IsMongoId, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';import { TicketPriority, TicketStatus, TicketType } from '../support-ticket.schema';
export class CreateTicketDto{@IsString()@MaxLength(200)title:string;@IsEnum(TicketType)type:TicketType;@IsString()@MaxLength(5000)message:string;@IsOptional()@IsMongoId()orderId?:string;@IsOptional()@IsMongoId()supplierId?:string;@IsOptional()@IsArray()@IsUrl({}, {each:true})attachments?:string[];}
export class ReplyTicketDto{@IsString()@MaxLength(5000)content:string;@IsOptional()@IsArray()@IsUrl({}, {each:true})attachments?:string[];}
export class UpdateTicketStatusDto{@IsEnum(TicketStatus)status:TicketStatus;@IsOptional()@IsString()@MaxLength(1000)note?:string;}
export class AssignTicketDto{@IsMongoId()staffId:string;}
export class SetTicketPriorityDto{@IsEnum(TicketPriority)priority:TicketPriority;}
