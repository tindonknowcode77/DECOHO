import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '../orders/order.schema';
import { Payment, PaymentDocument, PaymentStatus, SupplierPayoutStatus } from '../payments/payment.schema';
import { Product, ProductDocument } from '../products/product.schema';
import { Review, ReviewDocument, ReviewStatus } from '../reviews/review.schema';
import { SupplierApplicationStatus, User, UserDocument, UserRole, UserStatus } from '../users/user.schema';
import { UpdateSupplierOrderDto } from './dto/update-supplier-order.dto';
import { UpdateSupplierProfileDto } from './dto/update-supplier-profile.dto';

type ListFilters = { status?: string; query?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number };

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Product.name) private readonly products: Model<ProductDocument>,
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
    @InjectModel(Payment.name) private readonly payments: Model<PaymentDocument>,
    @InjectModel(Review.name) private readonly reviews: Model<ReviewDocument>,
  ) {}

  async profile(id: string) { return this.approvedSupplier(id); }

  async updateProfile(id: string, dto: UpdateSupplierProfileDto) {
    await this.approvedSupplier(id);
    const set: Record<string, unknown> = {};
    const map: Record<keyof UpdateSupplierProfileDto, string> = {
      storeName: 'supplierStoreName', description: 'supplierDescription', contactEmail: 'supplierContactEmail',
      contactPhone: 'supplierContactPhone', businessAddress: 'businessAddress', website: 'supplierWebsite',
      taxCode: 'supplierTaxCode', shippingAreas: 'supplierShippingAreas', warrantyPolicy: 'supplierWarrantyPolicy',
      returnPolicy: 'supplierReturnPolicy', bankName: 'supplierBankName', bankAccountNumber: 'supplierBankAccountNumber',
      bankAccountName: 'supplierBankAccountName',
    };
    for (const [key, field] of Object.entries(map)) {
      const value = dto[key as keyof UpdateSupplierProfileDto];
      if (value !== undefined) set[field] = Array.isArray(value) ? value.map((item) => item.trim()).filter(Boolean) : value.trim();
    }
    return this.users.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).exec();
  }

  async dashboard(id: string) {
    const supplier = await this.approvedSupplier(id); const supplierId = new Types.ObjectId(id);
    const [productSummary, orderSummary, paymentSummary, recentOrders, lowStock, reviewSummary] = await Promise.all([
      this.products.aggregate([{ $match: { supplierId } }, { $group: { _id: '$status', count: { $sum: 1 }, stock: { $sum: '$stock' }, sold: { $sum: '$soldCount' } } }]).exec(),
      this.orders.aggregate([{ $match: { supplierIds: supplierId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
      this.payments.aggregate([{ $match: { supplierId, status: { $in: [PaymentStatus.Success, PaymentStatus.PartialRefund] } } }, { $group: { _id: null, gross: { $sum: '$grossAmount' }, platformFee: { $sum: '$platformFee' }, revenue: { $sum: '$supplierAmount' }, pendingPayout: { $sum: { $cond: [{ $eq: ['$payoutStatus', SupplierPayoutStatus.Pending] }, '$supplierAmount', 0] } }, paidPayout: { $sum: { $cond: [{ $eq: ['$payoutStatus', SupplierPayoutStatus.Paid] }, '$supplierAmount', 0] } } } }]).exec(),
      this.orders.find({ supplierIds: supplierId }).sort({ createdAt: -1 }).limit(8).select('orderCode customerName status totalAmount items createdAt').lean().exec(),
      this.products.find({ supplierId, stock: { $lte: 5 } }).sort({ stock: 1 }).limit(10).select('name stock status image').lean().exec(),
      this.reviews.aggregate([{ $match: { supplierId, status: ReviewStatus.Visible } }, { $group: { _id: null, count: { $sum: 1 }, averageRating: { $avg: '$rating' } } }]).exec(),
    ]);
    return { supplier, products: productSummary, orders: orderSummary, payments: paymentSummary[0] ?? { gross: 0, platformFee: 0, revenue: 0, pendingPayout: 0, paidPayout: 0 }, reviews: reviewSummary[0] ?? { count: 0, averageRating: 0 }, recentOrders: recentOrders.map((order) => this.supplierOrder(order as unknown as Record<string, unknown>, id)), lowStock };
  }

  async listProducts(id: string, filters: ListFilters) {
    await this.approvedSupplier(id); const query: Record<string, unknown> = { supplierId: new Types.ObjectId(id) };
    if (filters.status) query.status = filters.status;
    if (filters.query) query.name = { $regex: this.escape(filters.query), $options: 'i' };
    const { page, limit } = this.page(filters); const [items, total] = await Promise.all([
      this.products.find(query).populate('brandId').populate('categoryId').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.products.countDocuments(query).exec(),
    ]); return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listOrders(id: string, filters: ListFilters) {
    await this.approvedSupplier(id); const query: Record<string, unknown> = { supplierIds: new Types.ObjectId(id) };
    if (filters.status) query.status = filters.status;
    this.dateFilter(query, filters);
    const { page, limit } = this.page(filters); const [rawItems, total] = await Promise.all([
      this.orders.find(query).populate('userId', 'fullName email phone').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.orders.countDocuments(query).exec(),
    ]); return { items: rawItems.map((order) => this.supplierOrder(order as unknown as Record<string, unknown>, id)), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async orderDetails(id: string, orderId: string) {
    await this.approvedSupplier(id); this.objectId(orderId);
    const order = await this.orders.findOne({ _id: orderId, supplierIds: new Types.ObjectId(id) }).populate('userId', 'fullName email phone').lean().exec();
    if (!order) throw new NotFoundException('Supplier order not found');
    return this.supplierOrder(order as unknown as Record<string, unknown>, id);
  }

  async updateOrder(id: string, orderId: string, dto: UpdateSupplierOrderDto) {
    await this.approvedSupplier(id); this.objectId(orderId);
    const allowed: Record<string, OrderStatus[]> = { PENDING: [OrderStatus.Confirmed], CONFIRMED: [OrderStatus.Processing], PROCESSING: [OrderStatus.Shipping], SHIPPING: [OrderStatus.Delivered] };
    const order = await this.orders.findOne({ _id: orderId, supplierIds: new Types.ObjectId(id) }).exec();
    if (!order) throw new NotFoundException('Supplier order not found');
    if (!allowed[order.status]?.includes(dto.status)) throw new BadRequestException(`Cannot change order from ${order.status} to ${dto.status}`);
    order.status = dto.status; if (dto.trackingCode !== undefined) order.trackingCode = dto.trackingCode.trim(); if (dto.shippingProvider !== undefined) order.shippingProvider = dto.shippingProvider.trim();
    order.statusHistory.push({ status: dto.status, at: new Date(), changedBy: new Types.ObjectId(id), note: dto.note?.trim() });
    await order.save(); return this.supplierOrder(order.toObject() as unknown as Record<string, unknown>, id);
  }

  async payouts(id: string, filters: ListFilters) {
    await this.approvedSupplier(id); const query: Record<string, unknown> = { supplierId: new Types.ObjectId(id) };
    if (filters.status) query.payoutStatus = filters.status; this.dateFilter(query, filters);
    const { page, limit } = this.page(filters); const [items, total] = await Promise.all([
      this.payments.find(query).populate('orderId', 'orderCode status').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.payments.countDocuments(query).exec(),
    ]); return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listReviews(id: string, filters: ListFilters) {
    await this.approvedSupplier(id); const query: Record<string, unknown> = { supplierId: new Types.ObjectId(id) };
    if (filters.status) query.status = filters.status; this.dateFilter(query, filters);
    const { page, limit } = this.page(filters); const [items, total] = await Promise.all([
      this.reviews.find(query).populate('userId', 'fullName avatar').populate('productId', 'name image').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.reviews.countDocuments(query).exec(),
    ]); return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private async approvedSupplier(id: string) {
    this.objectId(id); const supplier = await this.users.findOne({ _id: id, role: UserRole.Supplier, status: UserStatus.Active, supplierApplicationStatus: SupplierApplicationStatus.Approved }).exec();
    if (!supplier) throw new ForbiddenException('Approved active supplier account is required'); return supplier;
  }
  private page(filters: ListFilters) { return { page: Math.max(1, filters.page ?? 1), limit: Math.min(100, Math.max(1, filters.limit ?? 20)) }; }
  private supplierOrder(order: Record<string, unknown>, id: string) {
    const items = ((order.items as Array<Record<string, unknown>> | undefined) ?? []).filter((item) => String(item.supplierId) === id);
    const supplierSubtotal = items.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);
    return { ...order, items, supplierSubtotal };
  }
  private dateFilter(query: Record<string, unknown>, filters: ListFilters) { if (!filters.dateFrom && !filters.dateTo) return; const range: Record<string, Date> = {}; if (filters.dateFrom) range.$gte = new Date(filters.dateFrom); if (filters.dateTo) { const end = new Date(filters.dateTo); end.setHours(23, 59, 59, 999); range.$lte = end; } query.createdAt = range; }
  private objectId(id: string) { if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id'); }
  private escape(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
}
