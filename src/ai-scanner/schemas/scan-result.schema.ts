import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScanResultDocument = HydratedDocument<ScanResult>;

export enum DetectionStatus { Confirmed='CONFIRMED', NeedReview='NEED_REVIEW', Corrected='CORRECTED' }

@Schema({ _id: true })
export class DetectedProduct {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, trim: true })
  material: string;

  @Prop({ required: true, trim: true })
  color: string;

  @Prop({ required: true, trim: true })
  style: string;

  @Prop({ required: true, trim: true })
  dimensions: string;

  @Prop({ required: true, min: 0, max: 1 })
  confidence: number;

  @Prop({ type: String, enum: Object.values(DetectionStatus), default: DetectionStatus.Confirmed })
  status: DetectionStatus;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  linkedProductId?: Types.ObjectId;
}

export const DetectedProductSchema =
  SchemaFactory.createForClass(DetectedProduct);

@Schema({
  collection: 'ai_scan_results',
  timestamps: true,
  versionKey: false,
})
export class ScanResult {
  createdAt: Date;

  updatedAt: Date;

  @Prop({ required: true, trim: true })
  originalFileName: string;

  @Prop({ required: true, trim: true })
  mimeType: string;

  @Prop({ required: true, min: 0 })
  fileSize: number;

  @Prop({ required: true, trim: true })
  roomType: string;

  @Prop({ type: [String], default: [] })
  dominantColors: string[];

  @Prop({ type: [DetectedProductSchema], default: [] })
  products: DetectedProduct[];

  @Prop({ required: true, trim: true })
  model: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 1, default: 0.6 })
  confidenceThreshold: number;

  @Prop({ default: false, index: true })
  needsReview: boolean;
}

export const ScanResultSchema = SchemaFactory.createForClass(ScanResult);

ScanResultSchema.index({ createdAt: -1 });

@Schema({collection:'ai_scanner_configs',timestamps:true,versionKey:false})
export class AiScannerConfig{
  @Prop({required:true,default:'default',unique:true}) key:string;
  @Prop({required:true,trim:true}) model:string;
  @Prop({required:true,min:0,max:1,default:0.6}) confidenceThreshold:number;
  @Prop({default:true}) isActive:boolean;
}
export type AiScannerConfigDocument=HydratedDocument<AiScannerConfig>;
export const AiScannerConfigSchema=SchemaFactory.createForClass(AiScannerConfig);

@Schema({collection:'ai_scanner_errors',timestamps:true,versionKey:false})
export class AiScannerError{
  @Prop({type:Types.ObjectId,ref:'User',index:true}) userId?:Types.ObjectId;
  @Prop({required:true,trim:true}) model:string;
  @Prop({required:true,trim:true}) message:string;
  @Prop() statusCode?:number;
  @Prop({trim:true}) fileName?:string;
}
export type AiScannerErrorDocument=HydratedDocument<AiScannerError>;
export const AiScannerErrorSchema=SchemaFactory.createForClass(AiScannerError);
