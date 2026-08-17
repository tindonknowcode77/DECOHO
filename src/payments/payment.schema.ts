import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;
export enum PaymentStatus { Pending = 'PENDING', Success = 'SUCCESS', Failed = 'FAILED', PartialRefund = 'PARTIAL_REFUND', Refunded = 'REFUNDED' }
export enum SupplierPayoutStatus { Pending = 'PENDING', Paid = 'PAID', Held = 'HELD' }

@Schema({ _id: false })
export class RefundEvent {
  @Prop({ required: true, min: 0 }) amount: number;
  @Prop({ required: true, maxlength: 1000 }) reason: string;
  @Prop({ required: true }) createdAt: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) processedBy?: Types.ObjectId;
}
const RefundEventSchema = SchemaFactory.createForClass(RefundEvent);

@Schema({ collection: 'payments', timestamps: true, versionKey: false })
export class Payment {
  @Prop({ required: true, unique: true, index: true }) transactionCode: string;
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true }) orderId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) supplierId?: Types.ObjectId;
  @Prop({ required: true, min: 0 }) grossAmount: number;
  @Prop({ required: true, min: 0 }) platformFee: number;
  @Prop({ required: true, min: 0 }) supplierAmount: number;
  @Prop({ min: 0, default: 0 }) refundedAmount: number;
  @Prop({ required: true, maxlength: 50, index: true }) method: string;
  @Prop({ enum: Object.values(PaymentStatus), default: PaymentStatus.Pending, index: true }) status: PaymentStatus;
  @Prop({ enum: Object.values(SupplierPayoutStatus), default: SupplierPayoutStatus.Pending, index: true }) payoutStatus: SupplierPayoutStatus;
  @Prop() gatewayReference?: string;
  @Prop({ maxlength: 1000 }) failureReason?: string;
  @Prop({ type: [RefundEventSchema], default: [] }) refunds: RefundEvent[];
  @Prop() paidAt?: Date;
  @Prop() payoutPaidAt?: Date;
  @Prop({ maxlength: 1000 }) payoutNote?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ createdAt: -1, status: 1 });
PaymentSchema.index({ supplierId: 1, payoutStatus: 1, createdAt: -1 });
