import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import csv from 'csv-parser';
import { Readable } from 'stream';
import {
  AffiliateClick,
  AffiliateClickDocument,
} from './schemas/affiliate-click.schema';
import {
  AffiliateOrder,
  AffiliateOrderDocument,
} from './schemas/affiliate-order.schema';
import { Product, ProductDocument } from '../products/product.schema';
import { User, UserDocument } from '../users/user.schema';

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @InjectModel(AffiliateClick.name)
    private readonly clickModel: Model<AffiliateClickDocument>,
    @InjectModel(AffiliateOrder.name)
    private readonly orderModel: Model<AffiliateOrderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  /**
   * Tiện ích: Kiểm tra chuỗi có phải là MongoDB ObjectId hợp lệ hay không
   */
  private isValidObjectId(id?: string): boolean {
    if (!id || typeof id !== 'string') return false;
    const cleanId = id.trim();
    return Types.ObjectId.isValid(cleanId) && new Types.ObjectId(cleanId).toString() === cleanId;
  }

  /**
   * Tiện ích: Chuyển đổi định dạng chuỗi tiền tệ (VND) từ file CSV Shopee sang kiểu số
   * Ví dụ: "150,000", "150.000₫", " 25,500.50 ₫ " -> số chuẩn
   */
  private parseMoney(value: unknown): number {
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    if (!value || typeof value !== 'string') return 0;

    // Loại bỏ ký hiệu tiền tệ ₫, khoảng trắng
    let str = value.replace(/[₫đĐ\s]/g, '').trim();
    if (!str) return 0;

    // Nếu chuỗi chứa cả dấu chấm và phẩy (ví dụ: 1,250.50 hoặc 1.250,50)
    if (str.includes(',') && str.includes('.')) {
      const lastComma = str.lastIndexOf(',');
      const lastDot = str.lastIndexOf('.');
      if (lastDot > lastComma) {
        // Định dạng US: 1,250.50
        str = str.replace(/,/g, '');
      } else {
        // Định dạng VN/EU: 1.250,50
        str = str.replace(/\./g, '').replace(',', '.');
      }
    } else if (str.includes(',')) {
      // Nếu chỉ có dấu phẩy: thường là dấu phân cách hàng nghìn ở VN (ví dụ: 150,000)
      const parts = str.split(',');
      if (parts.length > 1 && parts[parts.length - 1].length === 3) {
        str = str.replace(/,/g, '');
      } else if (parts.length === 2 && parts[1].length <= 2) {
        // Dấu phẩy thập phân: 150,5
        str = str.replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (str.includes('.')) {
      // Nếu chỉ có dấu chấm: kiểm tra xem là phân cách hàng nghìn hay thập phân
      const parts = str.split('.');
      if (parts.length > 1 && parts[parts.length - 1].length === 3) {
        str = str.replace(/\./g, '');
      }
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }

  /**
   * Tiện ích: Parse ngày tháng từ định dạng CSV Shopee
   */
  private parseDate(val: unknown): Date | null {
    if (!val || typeof val !== 'string') return null;
    const str = val.trim();
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // ===========================================================================
  // 1. GENERATE LINK
  // ===========================================================================

  /**
   * Tạo link tiếp thị Shopee chứa tham số sub_id1 là UserId của người dùng
   */
  generateLink(originalUrl: string, userId: string) {
    try {
      const url = new URL(originalUrl.trim());
      url.searchParams.set('sub_id1', userId);

      return {
        originalUrl,
        affiliateUrl: url.toString(),
        userId,
        subId1: userId,
      };
    } catch {
      // Trường hợp URL không đúng chuẩn URL() (ví dụ thiếu protocol)
      const separator = originalUrl.includes('?') ? '&' : '?';
      const affiliateUrl = `${originalUrl}${separator}sub_id1=${encodeURIComponent(userId)}`;
      return {
        originalUrl,
        affiliateUrl,
        userId,
        subId1: userId,
      };
    }
  }

  // ===========================================================================
  // 2. IMPORT BÁO CÁO CLICK (WebsiteClickReport)
  // ===========================================================================

  /**
   * Nhập file CSV WebsiteClickReport từ Shopee Affiliate
   */
  async importClickReport(fileBuffer: Buffer) {
    const records: any[] = [];
    const stream = Readable.from(fileBuffer);

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(
          csv({
            mapHeaders: ({ header }) => header.trim(),
          }),
        )
        .on('data', (row) => records.push(row))
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    if (records.length === 0) {
      return { totalRows: 0, upsertedCount: 0, matchedCount: 0 };
    }

    const bulkOps: any[] = [];

    for (const row of records) {
      const clickId = (row['Click id'] || row['Click ID'] || row['clickId'] || row['Click Id'] || '').toString().trim();
      if (!clickId) continue;

      const clickTimeRaw = row['Click Time'] || row['clickTime'] || row['Click time'];
      const clickTime = this.parseDate(clickTimeRaw) || new Date();

      const subId = (row['Sub_id'] || row['Sub_id1'] || row['subId'] || row['SubId'] || '').toString().trim();
      const referrer = (row['Referrer'] || row['referrer'] || '').toString().trim();
      const clickRegion = (row['Click Region'] || row['clickRegion'] || '').toString().trim();

      const userId = this.isValidObjectId(subId) ? new Types.ObjectId(subId) : null;

      bulkOps.push({
        updateOne: {
          filter: { clickId },
          update: {
            $set: {
              clickTime,
              subId,
              referrer,
              clickRegion,
              ...(userId ? { userId } : {}),
            },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length === 0) {
      return { totalRows: records.length, upsertedCount: 0, matchedCount: 0 };
    }

    const result = await this.clickModel.bulkWrite(bulkOps, { ordered: false });

    this.logger.log(
      `Đã xử lý Click Report: ${records.length} dòng, ${result.upsertedCount} thêm mới, ${result.matchedCount} cập nhật.`,
    );

    return {
      totalRows: records.length,
      upsertedCount: result.upsertedCount,
      matchedCount: result.matchedCount,
    };
  }

  // ===========================================================================
  // 3. IMPORT BÁO CÁO HOA HỒNG & ĐƠN HÀNG (AffiliateCommissionReport)
  // ===========================================================================

  /**
   * Nhập file CSV AffiliateCommissionReport từ Shopee Affiliate
   * Tự động gán userId nếu Sub_id1 là ObjectId hợp lệ
   */
  async importCommissionReport(fileBuffer: Buffer) {
    const records: any[] = [];
    const stream = Readable.from(fileBuffer);

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(
          csv({
            mapHeaders: ({ header }) => header.trim(),
          }),
        )
        .on('data', (row) => records.push(row))
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    if (records.length === 0) {
      return { totalRows: 0, upsertedCount: 0, matchedCount: 0, autoClaimedCount: 0 };
    }

    const bulkOps: any[] = [];
    let autoClaimedCount = 0;

    for (const row of records) {
      const conversionId = (row['Conversion id'] || row['Conversion ID'] || row['conversionId'] || '').toString().trim();
      const orderId = (row['Order id'] || row['Order ID'] || row['orderId'] || '').toString().trim();

      if (!conversionId || !orderId) continue;

      const orderStatus = (row['Order Status'] || row['orderStatus'] || 'Pending').toString().trim();
      const itemName = (row['Item Name'] || row['itemName'] || 'Sản phẩm Shopee').toString().trim();
      const shopName = (row['Shop Name'] || row['shopName'] || '').toString().trim();

      const orderTime = this.parseDate(row['Order Time'] || row['orderTime']) || new Date();
      const clickTime = this.parseDate(row['Click Time'] || row['clickTime']);

      const purchaseValue = this.parseMoney(
        row['Purchase Value(₫)'] || row['Purchase Value'] || row['purchaseValue'] || 0,
      );
      const commission = this.parseMoney(
        row['Affiliate Net Commission(₫)'] ||
          row['Item Total Commission(₫)'] ||
          row['Commission(₫)'] ||
          row['commission'] ||
          0,
      );

      const subId1 = (row['Sub_id1'] || row['Sub_id'] || row['subId1'] || '').toString().trim();
      const subId2 = (row['Sub_id2'] || row['subId2'] || '').toString().trim();
      const subId3 = (row['Sub_id3'] || row['subId3'] || '').toString().trim();
      const subId4 = (row['Sub_id4'] || row['subId4'] || '').toString().trim();
      const subId5 = (row['Sub_id5'] || row['subId5'] || '').toString().trim();

      // Kiểm tra Sub_id1 có phải là ObjectId hợp lệ không
      const isSubIdValidUser = this.isValidObjectId(subId1);
      const userId = isSubIdValidUser ? new Types.ObjectId(subId1) : null;

      if (isSubIdValidUser) {
        autoClaimedCount++;
      }

      // Xây dựng câu lệnh update
      const updateDoc: any = {
        $set: {
          orderId,
          conversionId,
          itemName,
          shopName,
          orderStatus,
          orderTime,
          clickTime,
          purchaseValue,
          commission,
          subId1,
          subId2,
          subId3,
          subId4,
          subId5,
        },
      };

      // Nếu có userId hợp lệ từ Sub_id1 -> tự động gán và đánh dấu isClaimed = true
      if (userId) {
        updateDoc.$set.userId = userId;
        updateDoc.$set.isClaimed = true;
        updateDoc.$set.claimedAt = new Date();
      } else {
        // Nếu không có Sub_id1, chỉ set mặc định userId = null và isClaimed = false khi INSERT mới
        updateDoc.$setOnInsert = {
          userId: null,
          isClaimed: false,
          claimedAt: null,
        };
      }

      bulkOps.push({
        updateOne: {
          filter: { conversionId },
          update: updateDoc,
          upsert: true,
        },
      });
    }

    if (bulkOps.length === 0) {
      return { totalRows: records.length, upsertedCount: 0, matchedCount: 0, autoClaimedCount: 0 };
    }

    const result = await this.orderModel.bulkWrite(bulkOps, { ordered: false });

    this.logger.log(
      `Đã xử lý Commission Report: ${records.length} dòng, ${result.upsertedCount} đơn mới, ${result.matchedCount} cập nhật, ${autoClaimedCount} đơn tự động gán user.`,
    );

    return {
      totalRows: records.length,
      upsertedCount: result.upsertedCount,
      matchedCount: result.matchedCount,
      autoClaimedCount,
    };
  }

  // ===========================================================================
  // 4. NHẬN ĐƠN HÀNG THỦ CÔNG (CLAIM ORDER)
  // ===========================================================================

  /**
   * Người dùng nhập mã đơn hàng Shopee để nhận đơn thủ công
   */
  async claimOrder(userId: string, orderId: string) {
    if (!this.isValidObjectId(userId)) {
      throw new BadRequestException('ID người dùng không hợp lệ.');
    }

    const cleanOrderId = orderId.trim();
    if (!cleanOrderId) {
      throw new BadRequestException('Mã đơn hàng không được để trống.');
    }

    // Một mã Order ID của Shopee có thể chứa nhiều sản phẩm (nhiều Conversion ID)
    const items = await this.orderModel.find({ orderId: cleanOrderId });

    if (!items || items.length === 0) {
      throw new NotFoundException(
        `Không tìm thấy đơn hàng với mã "${cleanOrderId}". Báo cáo từ Shopee có thể chưa được đồng bộ hoặc mã đơn chưa chính xác.`,
      );
    }

    // Kiểm tra xem đơn đã được gán user nào chưa
    const alreadyClaimed = items.find((item) => item.isClaimed || item.userId);
    if (alreadyClaimed) {
      if (alreadyClaimed.userId?.toString() === userId) {
        throw new BadRequestException('Đơn hàng này đã được bạn nhận trước đó.');
      }
      throw new BadRequestException('Đơn hàng này đã được ghi nhận cho một tài khoản khác.');
    }

    const targetUserId = new Types.ObjectId(userId);
    const now = new Date();

    // Cập nhật tất cả các mục của đơn hàng này
    await this.orderModel.updateMany(
      { orderId: cleanOrderId },
      {
        $set: {
          userId: targetUserId,
          isClaimed: true,
          claimedAt: now,
        },
      },
    );

    const totalCommission = items.reduce((sum, item) => sum + (item.commission || 0), 0);
    const totalPurchaseValue = items.reduce((sum, item) => sum + (item.purchaseValue || 0), 0);

    return {
      success: true,
      orderId: cleanOrderId,
      itemsCount: items.length,
      totalCommission,
      totalPurchaseValue,
      message: `Nhận đơn thành công! Đã ghi nhận ${items.length} món đồ với tổng hoa hồng ${totalCommission.toLocaleString('vi-VN')} ₫.`,
    };
  }

  // ===========================================================================
  // 5. THỐNG KÊ DASHBOARD CỦA USER (MY STATS)
  // ===========================================================================

  /**
   * Lấy tổng quan hoa hồng, giá trị đơn và danh sách đơn hàng của người dùng hiện tại
   */
  async getUserDashboard(userId: string) {
    if (!this.isValidObjectId(userId)) {
      throw new BadRequestException('ID người dùng không hợp lệ.');
    }

    const userObjectId = new Types.ObjectId(userId);

    // Thống kê tổng hợp đơn hàng bằng Aggregation
    const stats = await this.orderModel.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$commission' },
          totalGMV: { $sum: '$purchaseValue' },
          totalOrders: { $sum: 1 },
          completedCommission: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$orderStatus', regex: /completed|thành công/i } },
                '$commission',
                0,
              ],
            },
          },
        },
      },
    ]);

    const totalClicks = await this.clickModel.countDocuments({ userId: userObjectId });

    // Lấy 30 đơn hàng gần nhất
    const recentOrders = await this.orderModel
      .find({ userId: userObjectId })
      .sort({ orderTime: -1 })
      .limit(30)
      .lean();

    const summary = stats[0] || {
      totalCommission: 0,
      totalGMV: 0,
      totalOrders: 0,
      completedCommission: 0,
    };

    return {
      totalClicks,
      totalOrders: summary.totalOrders,
      totalGMV: summary.totalGMV,
      totalCommission: summary.totalCommission,
      completedCommission: summary.completedCommission,
      recentOrders,
    };
  }

  // ===========================================================================
  // 6. TỔNG QUAN HỆ THỐNG DÀNH CHO ADMIN
  // ===========================================================================

  /**
   * Tính toán toàn bộ chỉ số KPI dành cho Admin
   */
  async getAdminOverview() {
    const totalClicks = await this.clickModel.countDocuments();
    const totalOrders = await this.orderModel.countDocuments();

    const stats = await this.orderModel.aggregate([
      {
        $group: {
          _id: null,
          totalGMV: { $sum: '$purchaseValue' },
          totalCommission: { $sum: '$commission' },
          claimedCount: {
            $sum: { $cond: ['$isClaimed', 1, 0] },
          },
          unclaimedCount: {
            $sum: { $cond: ['$isClaimed', 0, 1] },
          },
        },
      },
    ]);

    const summary = stats[0] || {
      totalGMV: 0,
      totalCommission: 0,
      claimedCount: 0,
      unclaimedCount: 0,
    };

    // Tỷ lệ chuyển đổi: CR = (Tổng đơn / Tổng click) * 100
    const conversionRate = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;

    // Lấy 25 đơn hàng mới nhất có kèm thông tin User
    const recentOrders = await this.orderModel
      .find()
      .populate('userId', 'fullName email')
      .sort({ orderTime: -1 })
      .limit(25)
      .lean();

    // Lấy 30 lượt click mới nhất có kèm thông tin User và Product
    const recentClicks = await this.clickModel
      .find()
      .populate('userId', 'fullName email')
      .populate('productId', 'name image category')
      .sort({ clickTime: -1, createdAt: -1 })
      .limit(30)
      .lean();

    return {
      totalClicks,
      totalOrders,
      totalGMV: summary.totalGMV,
      totalCommission: summary.totalCommission,
      claimedCount: summary.claimedCount,
      unclaimedCount: summary.unclaimedCount,
      conversionRate: Math.round(conversionRate * 100) / 100,
      recentOrders,
      recentClicks,
    };
  }

  /**
   * Ghi nhận 1 lượt click mua Shopee trực tiếp từ Website / Mobile
   */
  async recordLiveClick(params: {
    userId?: string | null;
    productId?: string;
    productName?: string;
    productLink?: string;
    referrer?: string;
    source?: string;
  }) {
    const clickId = `clk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    let userObjectId: Types.ObjectId | null = null;
    if (params.userId && this.isValidObjectId(params.userId)) {
      userObjectId = new Types.ObjectId(params.userId);
    }

    let productObjectId: Types.ObjectId | null = null;
    let productName = params.productName?.trim() || '';
    let targetUrl = params.productLink?.trim() || '';

    if (params.productId && this.isValidObjectId(params.productId)) {
      productObjectId = new Types.ObjectId(params.productId);
      try {
        const prod = await this.productModel.findByIdAndUpdate(
          productObjectId,
          { $inc: { shopeeClicks: 1 } },
          { new: true },
        );
        if (prod) {
          if (!productName) productName = prod.name;
          if (!targetUrl && prod.productLink) targetUrl = prod.productLink;
        }
      } catch (err) {
        this.logger.warn(`Lỗi cập nhật shopeeClicks cho sản phẩm ${params.productId}: ${err}`);
      }
    }

    const click = await this.clickModel.create({
      clickId,
      clickTime: now,
      userId: userObjectId,
      subId: userObjectId ? userObjectId.toString() : '',
      productId: productObjectId,
      productName,
      targetUrl,
      referrer: params.referrer || '',
      clickRegion: params.source || 'web',
    });

    this.logger.log(
      `Đã ghi nhận 1 click Shopee: [${clickId}] Sản phẩm: "${productName || 'Không tên'}", User: ${userObjectId ? userObjectId.toString() : 'Khách vãng lai'}`,
    );

    return {
      success: true,
      clickId: click.clickId,
      clickTime: click.clickTime,
      totalClicks: await this.clickModel.countDocuments(),
    };
  }

  // ===========================================================================
  // 7. ADMIN: GÁN ĐƠN HÀNG THỦ CÔNG CHO NGƯỜI DÙNG
  // ===========================================================================

  async adminAssignOrder(orderId: string, userIdentifier: string) {
    const cleanOrderId = orderId?.trim();
    const cleanUserIdentifier = userIdentifier?.trim();

    if (!cleanOrderId || !cleanUserIdentifier) {
      throw new BadRequestException('Mã đơn hàng và thông tin người dùng không được để trống.');
    }

    const items = await this.orderModel.find({ orderId: cleanOrderId });
    if (!items || items.length === 0) {
      throw new NotFoundException(`Không tìm thấy đơn hàng Shopee với mã "${cleanOrderId}".`);
    }

    const user = this.isValidObjectId(cleanUserIdentifier)
      ? await this.userModel.findById(cleanUserIdentifier).exec()
      : await this.userModel
          .findOne({ email: cleanUserIdentifier.toLowerCase() })
          .exec();

    if (!user) {
      throw new NotFoundException(
        `Không tìm thấy tài khoản người dùng với Email/ID "${cleanUserIdentifier}".`,
      );
    }

    const now = new Date();
    await this.orderModel.updateMany(
      { orderId: cleanOrderId },
      {
        $set: {
          userId: user._id,
          isClaimed: true,
          claimedAt: now,
        },
      },
    );

    const totalCommission = items.reduce((sum, item) => sum + (item.commission || 0), 0);

    return {
      success: true,
      orderId: cleanOrderId,
      itemsCount: items.length,
      totalCommission,
      assignedUser: {
        _id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
      },
      message: `Đã gán đơn ${cleanOrderId} (${items.length} sản phẩm) cho ${user.fullName || user.email}.`,
    };
  }
}

