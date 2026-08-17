import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument, ProductStatus } from '../products/product.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderDocument, OrderStatus, ComplaintStatus } from './order.schema';
import { PromotionsService } from '../promotions/promotions.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly promotionsService: PromotionsService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    this.assertId(userId);
    const ids = dto.items.map((item) => new Types.ObjectId(item.productId));
    const products = await this.productModel.find({ _id: { $in: ids }, status: ProductStatus.Approved, isLocked: { $ne: true } }).exec();
    if (products.length !== new Set(dto.items.map((item) => item.productId)).size) throw new BadRequestException('One or more products are unavailable');
    const items = dto.items.map((item) => {
      const product = products.find((value) => value.id === item.productId)!;
      if (product.stock < item.quantity) throw new BadRequestException(`${product.name} does not have enough stock`);
      const unitPrice = product.salePrice ?? product.price;
      return { productId: product._id, supplierId: product.supplierId, name: product.name, image: product.image, unitPrice, quantity: item.quantity, lineTotal: unitPrice * item.quantity };
    });
    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
    const promotion = dto.promotionCode
      ? await this.promotionsService.validateCode(dto.promotionCode, {
          subtotal,
          productIds: products.map((product) => product.id),
          categoryIds: products.flatMap((product) =>
            product.categoryId ? [product.categoryId.toString()] : [],
          ),
          supplierIds: products.flatMap((product) =>
            product.supplierId ? [product.supplierId.toString()] : [],
          ),
        })
      : null;
    const discountAmount = promotion?.discountAmount ?? 0;
    const now = new Date();
    const order = await this.orderModel.create({
      ...dto,
      orderCode: `DH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId: new Types.ObjectId(userId),
      supplierIds: [...new Set(items.flatMap((item) => item.supplierId ? [item.supplierId.toString()] : []))].map((id) => new Types.ObjectId(id)),
      items,
      subtotal,
      discountAmount,
      totalAmount: subtotal - discountAmount,
      promotionCode: promotion?.code,
      promotionId: promotion?.promotionId,
      customerEmail: dto.customerEmail.toLowerCase().trim(),
      status: OrderStatus.Pending,
      statusHistory: [{ status: OrderStatus.Pending, at: now, changedBy: new Types.ObjectId(userId) }],
    });
    if (promotion) {
      try {
        await this.promotionsService.redeem(promotion.code);
      } catch (error) {
        await this.orderModel.deleteOne({ _id: order._id }).exec();
        throw error;
      }
    }
    return order;
  }

  async findMine(userId: string) { this.assertId(userId); return this.orderModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec(); }

  async findAllForAdmin(filters: { supplierId?: string; userId?: string; status?: OrderStatus; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) {
    const filter: Record<string, unknown> = {};
    if (filters.supplierId) { this.assertId(filters.supplierId); filter.supplierIds = new Types.ObjectId(filters.supplierId); }
    if (filters.userId) { this.assertId(filters.userId); filter.userId = new Types.ObjectId(filters.userId); }
    if (filters.status) filter.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (filters.dateFrom) createdAt.$gte = this.parseDate(filters.dateFrom, 'dateFrom');
      if (filters.dateTo) { const end = this.parseDate(filters.dateTo, 'dateTo'); end.setHours(23, 59, 59, 999); createdAt.$lte = end; }
      filter.createdAt = createdAt;
    }
    const page = Math.max(filters.page ?? 1, 1); const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const [items, total] = await Promise.all([
      this.orderModel.find(filter).populate('userId', 'fullName email phone').populate('supplierIds', 'supplierStoreName fullName email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) { this.assertId(id); const order = await this.orderModel.findById(id).populate('userId', 'fullName email phone').populate('supplierIds', 'supplierStoreName fullName email').populate('items.productId').exec(); if (!order) throw new NotFoundException('Order not found'); return order; }

  async transition(id: string, status: OrderStatus, adminId: string, details?: { note?: string; trackingCode?: string; shippingProvider?: string }) {
    const order = await this.findById(id); this.assertId(adminId);
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.Confirmed, OrderStatus.Cancelled], CONFIRMED: [OrderStatus.Processing, OrderStatus.Cancelled],
      PROCESSING: [OrderStatus.Shipping, OrderStatus.Cancelled], SHIPPING: [OrderStatus.Delivered, OrderStatus.Cancelled],
      DELIVERED: [OrderStatus.Refunded], CANCELLED: [], REFUNDED: [],
    };
    if (!allowed[order.status].includes(status)) throw new BadRequestException(`Cannot change ${order.status} to ${status}`);
    order.status = status; order.statusHistory.push({ status, at: new Date(), changedBy: new Types.ObjectId(adminId), note: details?.note });
    if (details?.trackingCode) order.trackingCode = details.trackingCode;
    if (details?.shippingProvider) order.shippingProvider = details.shippingProvider;
    if (status === OrderStatus.Confirmed) {
      await this.productModel.bulkWrite(order.items.map((item) => ({ updateOne: { filter: { _id: item.productId, stock: { $gte: item.quantity } }, update: { $inc: { stock: -item.quantity, soldCount: item.quantity } } } })));
    }
    return order.save();
  }

  async cancel(id: string, adminId: string, reason: string) { const order = await this.transition(id, OrderStatus.Cancelled, adminId, { note: reason }); order.cancellationReason = reason.trim(); return order.save(); }

  async refund(id: string, adminId: string, reason: string, amount?: number) {
    const order = await this.findById(id); this.assertId(adminId);
    if ([OrderStatus.Cancelled, OrderStatus.Refunded].includes(order.status)) throw new BadRequestException('Order cannot be refunded');
    const refundAmount = amount ?? order.totalAmount;
    if (refundAmount > order.totalAmount) throw new BadRequestException('Refund amount exceeds order total');
    order.status = OrderStatus.Refunded; order.paymentStatus = 'REFUNDED'; order.refundedAmount = refundAmount; order.refundReason = reason.trim();
    order.statusHistory.push({ status: OrderStatus.Refunded, at: new Date(), changedBy: new Types.ObjectId(adminId), note: reason });
    return order.save();
  }

  async openComplaint(id: string, userId: string, message: string) { this.assertId(id); this.assertId(userId); const order = await this.orderModel.findOneAndUpdate({ _id: id, userId: new Types.ObjectId(userId), status: { $nin: [OrderStatus.Cancelled, OrderStatus.Refunded] } }, { $set: { complaintStatus: ComplaintStatus.Open, complaintMessage: message.trim() } }, { new: true }).exec(); if (!order) throw new NotFoundException('Order not found'); return order; }
  async resolveComplaint(id: string, resolution: string) { this.assertId(id); const order = await this.orderModel.findOneAndUpdate({ _id: id, complaintStatus: { $in: [ComplaintStatus.Open, ComplaintStatus.Processing] } }, { $set: { complaintStatus: ComplaintStatus.Resolved, complaintResolution: resolution.trim() } }, { new: true }).exec(); if (!order) throw new NotFoundException('Open complaint not found'); return order; }

  private assertId(id: string) { if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id'); }
  private parseDate(value: string, field: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} is invalid`); return date; }
}
