import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '../orders/order.schema';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { Payment, PaymentDocument, PaymentStatus, SupplierPayoutStatus } from './payment.schema';

type PaymentFilters = { status?: PaymentStatus; method?: string; supplierId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number };

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  async findAll(filters: PaymentFilters) {
    const filter = this.buildFilter(filters); const page = Math.max(filters.page ?? 1, 1); const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const [items,total,summary] = await Promise.all([
      this.paymentModel.find(filter).populate('orderId','orderCode status').populate('userId','fullName email').populate('supplierId','supplierStoreName fullName email').sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit).exec(),
      this.paymentModel.countDocuments(filter).exec(),
      this.paymentModel.aggregate<{ _id: null; gross: number; fees: number; supplier: number; refunded: number }>([{ $match: filter },{ $group:{ _id:null,gross:{ $sum:'$grossAmount' },fees:{ $sum:'$platformFee' },supplier:{ $sum:'$supplierAmount' },refunded:{ $sum:'$refundedAmount' } } }]).exec(),
    ]);
    return { items,total,page,limit,totalPages:Math.ceil(total/limit),summary:summary[0] ?? { gross:0,fees:0,supplier:0,refunded:0 } };
  }

  async findById(id: string) { this.assertId(id); const payment = await this.paymentModel.findById(id).populate('orderId').populate('userId','fullName email phone').populate('supplierId','supplierStoreName fullName email').exec(); if (!payment) throw new NotFoundException('Payment not found'); return payment; }

  async refund(id: string, dto: RefundPaymentDto, adminId: string) {
    this.assertId(id); this.assertId(adminId); const payment = await this.paymentModel.findById(id).exec();
    if (!payment) throw new NotFoundException('Payment not found');
    if (![PaymentStatus.Success,PaymentStatus.PartialRefund].includes(payment.status)) throw new BadRequestException('Only successful payments can be refunded');
    const remaining = payment.grossAmount-payment.refundedAmount; if (dto.amount>remaining) throw new BadRequestException('Refund amount exceeds remaining payment amount');
    payment.refundedAmount += dto.amount; payment.status = payment.refundedAmount===payment.grossAmount ? PaymentStatus.Refunded : PaymentStatus.PartialRefund;
    payment.supplierAmount = Math.max(0,payment.grossAmount-payment.refundedAmount-payment.platformFee); payment.payoutStatus = SupplierPayoutStatus.Held;
    payment.refunds.push({ amount:dto.amount,reason:dto.reason.trim(),createdAt:new Date(),processedBy:new Types.ObjectId(adminId) }); await payment.save();
    await this.orderModel.findByIdAndUpdate(payment.orderId,{ $set:{ paymentStatus:payment.status,refundedAmount:payment.refundedAmount,...(payment.status===PaymentStatus.Refunded ? { status:OrderStatus.Refunded,refundReason:dto.reason.trim() } : {}) } }).exec();
    return payment;
  }

  async updatePayout(id: string, status: SupplierPayoutStatus.Paid | SupplierPayoutStatus.Held, note?: string) {
    this.assertId(id); const payment = await this.paymentModel.findOneAndUpdate({ _id:id,status:{ $in:[PaymentStatus.Success,PaymentStatus.PartialRefund] },supplierId:{ $exists:true } },{ $set:{ payoutStatus:status,payoutNote:note?.trim(),...(status===SupplierPayoutStatus.Paid ? { payoutPaidAt:new Date() } : {}) } },{ new:true,runValidators:true }).exec();
    if (!payment) throw new NotFoundException('Eligible supplier payment not found'); return payment;
  }

  async getSupplierPayouts() {
    return this.paymentModel.aggregate([{ $match:{ supplierId:{ $exists:true },status:{ $in:[PaymentStatus.Success,PaymentStatus.PartialRefund] } } },{ $group:{ _id:'$supplierId',grossAmount:{ $sum:'$grossAmount' },platformFee:{ $sum:'$platformFee' },supplierAmount:{ $sum:'$supplierAmount' },pendingAmount:{ $sum:{ $cond:[{ $eq:['$payoutStatus',SupplierPayoutStatus.Pending] },'$supplierAmount',0] } },paidAmount:{ $sum:{ $cond:[{ $eq:['$payoutStatus',SupplierPayoutStatus.Paid] },'$supplierAmount',0] } },transactionCount:{ $sum:1 } } },{ $lookup:{ from:'users',localField:'_id',foreignField:'_id',as:'supplier' } },{ $unwind:{ path:'$supplier',preserveNullAndEmptyArrays:true } },{ $sort:{ pendingAmount:-1 } }]).exec();
  }

  async exportCsv(filters: PaymentFilters): Promise<string> {
    const rows = await this.paymentModel.find(this.buildFilter(filters)).sort({ createdAt:-1 }).lean().exec();
    const header = ['Mã giao dịch','Đơn hàng','Phương thức','Trạng thái','Tổng tiền','Phí nền tảng','Tiền Supplier','Đã hoàn','Ngày tạo'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g,'""')}"`;
    return [header,...rows.map((item) => [item.transactionCode,item.orderId,item.method,item.status,item.grossAmount,item.platformFee,item.supplierAmount,item.refundedAmount,(item as typeof item & { createdAt?: Date }).createdAt?.toISOString() ?? ''])].map((row) => row.map(escape).join(',')).join('\n');
  }

  private buildFilter(filters: PaymentFilters) { const filter: Record<string,unknown> = {}; if (filters.status) filter.status=filters.status; if (filters.method) filter.method=filters.method; if (filters.supplierId) { this.assertId(filters.supplierId); filter.supplierId=new Types.ObjectId(filters.supplierId); } if (filters.dateFrom||filters.dateTo) { const value:Record<string,Date>={}; if(filters.dateFrom)value.$gte=this.date(filters.dateFrom); if(filters.dateTo){const end=this.date(filters.dateTo);end.setHours(23,59,59,999);value.$lte=end;} filter.createdAt=value; } return filter; }
  private assertId(id:string){if(!Types.ObjectId.isValid(id))throw new BadRequestException('Invalid id');}
  private date(value:string){const result=new Date(value);if(Number.isNaN(result.getTime()))throw new BadRequestException('Invalid date');return result;}
}
