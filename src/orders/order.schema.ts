import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

export enum OrderStatus {
  Pending = 'PENDING', Confirmed = 'CONFIRMED', Processing = 'PROCESSING',
  Shipping = 'SHIPPING', Delivered = 'DELIVERED', Cancelled = 'CANCELLED', Refunded = 'REFUNDED',
}

export enum ComplaintStatus { None = 'NONE', Open = 'OPEN', Processing = 'PROCESSING', Resolved = 'RESOLVED', Rejected = 'REJECTED' }

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true }) productId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) supplierId?: Types.ObjectId;
  @Prop({ required: true }) name: string;
  @Prop() image?: string;
  @Prop({ required: true, min: 0 }) unitPrice: number;
  @Prop({ required: true, min: 1 }) quantity: number;
  @Prop({ required: true, min: 0 }) lineTotal: number;
}
const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
export class OrderStatusEvent {
  @Prop({ enum: Object.values(OrderStatus), required: true }) status: OrderStatus;
  @Prop({ required: true }) at: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) changedBy?: Types.ObjectId;
  @Prop({ maxlength: 500 }) note?: string;
}
const OrderStatusEventSchema = SchemaFactory.createForClass(OrderStatusEvent);

@Schema({ collection: 'orders', timestamps: true, versionKey: false })
export class Order {
  @Prop({ required: true, unique: true, index: true }) orderCode: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [], index: true }) supplierIds: Types.ObjectId[];
  @Prop({ type: [OrderItemSchema], required: true }) items: OrderItem[];
  @Prop({ required: true, min: 0 }) subtotal: number;
  @Prop({ min: 0, default: 0 }) discountAmount: number;
  @Prop({ uppercase: true, trim: true }) promotionCode?: string;
  @Prop({ type: Types.ObjectId, ref: 'Promotion' }) promotionId?: Types.ObjectId;
  @Prop({ min: 0, default: 0 }) shippingFee: number;
  @Prop({ required: true, min: 0 }) totalAmount: number;
  @Prop({ required: true }) customerName: string;
  @Prop({ required: true, lowercase: true }) customerEmail: string;
  @Prop({ required: true }) customerPhone: string;
  @Prop({ required: true }) shippingAddress: string;
  @Prop({ default: 'COD' }) paymentMethod: string;
  @Prop({ default: 'UNPAID' }) paymentStatus: string;
  @Prop({ enum: Object.values(OrderStatus), default: OrderStatus.Pending, index: true }) status: OrderStatus;
  @Prop({ type: [OrderStatusEventSchema], default: [] }) statusHistory: OrderStatusEvent[];
  @Prop({ enum: Object.values(ComplaintStatus), default: ComplaintStatus.None, index: true }) complaintStatus: ComplaintStatus;
  @Prop({ maxlength: 2000 }) complaintMessage?: string;
  @Prop({ maxlength: 2000 }) complaintResolution?: string;
  @Prop({ min: 0, default: 0 }) refundedAmount: number;
  @Prop({ maxlength: 1000 }) cancellationReason?: string;
  @Prop({ maxlength: 1000 }) refundReason?: string;
  @Prop() trackingCode?: string;
  @Prop() shippingProvider?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ createdAt: -1, status: 1 });
OrderSchema.index({ supplierIds: 1, createdAt: -1 });
