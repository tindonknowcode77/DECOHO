import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import {
  DecorPlan,
  DecorPlanDocument,
} from '../decor-plans/decor-plan.schema';
import { Favorite, FavoriteDocument } from '../favorites/favorite.schema';
import { Room, RoomDocument } from '../rooms/room.schema';
import { Product, ProductDocument } from '../products/product.schema';
import {
  SupplierApplicationStatus,
  User,
  UserDocument,
  UserRole,
  UserStatus,
} from '../users/user.schema';
import { SupplierReviewDecision } from './dto/review-supplier-application.dto';
import { SupplierStatusAction } from './dto/update-supplier-status.dto';
import { Role } from '../common/enums/roles.enum';

type MostPopularStyleAggregation = {
  _id: string;
  total: number;
};

type MostSavedDecorPlanAggregation = {
  decorPlanId: Types.ObjectId;
  savedCount: number;
  decorPlan?: {
    _id: Types.ObjectId;
    style?: string;
    estimatedCost?: number;
    designSuggestion?: string;
  };
};

export type DashboardStatisticsResponse = {
  totalUsers: number;
  totalRooms: number;
  totalDecorPlans: number;
  totalProducts: number;
  totalSuppliers: number;
  pendingSupplierApplications: number;
  totalOrders: number;
  revenue: number;
  lowStockProducts: number;
  newOrders: number;
  revenueChart: Array<{ label: string; revenue: number }>;
  topSellingProducts: Array<{
    productId: string;
    name: string;
    soldCount: number;
    revenue: number;
    stock: number;
  }>;
  mostPopularStyle: {
    style: string;
    totalDecorPlans: number;
  } | null;
  mostSavedDecorPlan: {
    decorPlanId: string;
    savedCount: number;
    style?: string;
    estimatedCost?: number;
    designSuggestion?: string;
  } | null;
};

export enum RevenuePeriod {
  Day = 'day',
  Month = 'month',
  Year = 'year',
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(DecorPlan.name)
    private readonly decorPlanModel: Model<DecorPlanDocument>,
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async getDashboardStatistics(): Promise<DashboardStatisticsResponse> {
    const [
      totalUsers,
      totalRooms,
      totalDecorPlans,
      mostPopularStyleResult,
      mostSavedDecorPlanResult,
      totalProducts,
      totalSuppliers,
      pendingSupplierApplications,
      orderMetrics,
      lowStockProducts,
      revenueChart,
      topSellingProducts,
    ] = await Promise.all([
      this.countUsers(),
      this.roomModel.countDocuments().exec(),
      this.decorPlanModel.countDocuments().exec(),
      this.getMostPopularStyle(),
      this.getMostSavedDecorPlan(),
      this.productModel.countDocuments().exec(),
      this.userModel.countDocuments({ role: UserRole.Supplier, status: UserStatus.Active }).exec(),
      this.userModel.countDocuments({ supplierApplicationStatus: SupplierApplicationStatus.Pending }).exec(),
      this.getOrderMetrics(),
      this.productModel.countDocuments({ stock: { $gte: 0, $lte: 5 } }).exec(),
      this.getRevenueChart(),
      this.getTopSellingProducts(),
    ]);

    return {
      totalUsers,
      totalRooms,
      totalDecorPlans,
      totalProducts,
      totalSuppliers,
      pendingSupplierApplications,
      totalOrders: orderMetrics.totalOrders,
      revenue: orderMetrics.revenue,
      lowStockProducts,
      newOrders: orderMetrics.newOrders,
      revenueChart,
      topSellingProducts,
      mostPopularStyle: this.toMostPopularStyle(mostPopularStyleResult),
      mostSavedDecorPlan: this.toMostSavedDecorPlan(
        mostSavedDecorPlanResult,
      ),
    };
  }

  private async getOrderMetrics(): Promise<{
    totalOrders: number;
    revenue: number;
    newOrders: number;
  }> {
    const orders = this.connection.collection('orders');
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [totalOrders, newOrders, revenueResult] = await Promise.all([
      orders.countDocuments(),
      orders.countDocuments({ createdAt: { $gte: startOfToday } }),
      orders
        .aggregate<{ revenue: number }>([
          { $match: { status: { $nin: ['cancelled', 'refunded'] } } },
          { $group: { _id: null, revenue: { $sum: '$totalAmount' } } },
        ])
        .toArray(),
    ]);
    return {
      totalOrders,
      newOrders,
      revenue: Number(revenueResult[0]?.revenue ?? 0),
    };
  }

  async getRevenueChart(
    period: RevenuePeriod = RevenuePeriod.Day,
  ): Promise<
    Array<{ label: string; revenue: number }>
  > {
    const from = new Date();
    const config = {
      [RevenuePeriod.Day]: { format: '%Y-%m-%d', days: 29 },
      [RevenuePeriod.Month]: { format: '%Y-%m', days: 365 },
      [RevenuePeriod.Year]: { format: '%Y', days: 3650 },
    }[period];
    if (!config) {
      throw new BadRequestException('Revenue period must be day, month, or year');
    }
    from.setDate(from.getDate() - config.days);
    from.setHours(0, 0, 0, 0);
    return this.connection
      .collection('orders')
      .aggregate<{ _id: string; revenue: number }>([
        {
          $match: {
            createdAt: { $gte: from },
            status: { $nin: ['cancelled', 'refunded'] },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: config.format, date: '$createdAt' },
            },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray()
      .then((rows) =>
        rows.map((row) => ({ label: row._id, revenue: row.revenue })),
      );
  }

  private async getTopSellingProducts(): Promise<
    DashboardStatisticsResponse['topSellingProducts']
  > {
    const products = await this.productModel
      .find()
      .sort({ soldCount: -1, createdAt: -1 })
      .limit(5)
      .exec();
    return products.map((product) => ({
      productId: product.id,
      name: product.name,
      soldCount: product.soldCount ?? 0,
      revenue: (product.soldCount ?? 0) * product.price,
      stock: product.stock ?? 0,
    }));
  }

  async updateUserRole(
    userId: string,
    role: UserRole,
    actorRole: Role,
  ): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    if (role === UserRole.SuperAdmin && actorRole !== Role.SUPER_ADMIN) {
      throw new BadRequestException('Only SUPER_ADMIN can grant SUPER_ADMIN');
    }
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          status: { $ne: UserStatus.Deleted },
          ...(actorRole === Role.SUPER_ADMIN
            ? {}
            : { role: { $ne: UserRole.SuperAdmin } }),
        },
        { $set: { role } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getUsers(filters: {
    query?: string;
    role?: UserRole;
    status?: UserStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const filter: Record<string, unknown> = {
      status: filters.status ?? { $ne: UserStatus.Deleted },
    };
    if (filters.role) filter.role = filters.role;
    if (filters.query?.trim()) {
      const escaped = filters.query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const search = new RegExp(escaped, 'i');
      filter.$or = [{ fullName: search }, { email: search }, { phone: search }];
    }
    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUserDetails(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.userModel
      .findOne({ _id: userId, status: { $ne: UserStatus.Deleted } })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    const orders = await this.connection
      .collection('orders')
      .find({ $or: [{ userId: new Types.ObjectId(userId) }, { userId }] })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return { user, purchaseHistory: orders };
  }

  async updateUserStatus(
    userId: string,
    status: UserStatus.Active | UserStatus.Suspended,
    actorRole: Role,
  ): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          role:
            actorRole === Role.SUPER_ADMIN
              ? { $ne: UserRole.SuperAdmin }
              : { $nin: [UserRole.Admin, UserRole.SuperAdmin] },
          status: { $ne: UserStatus.Deleted },
        },
        { $set: { status }, ...(status === UserStatus.Suspended ? { $unset: { refreshTokenHash: '' } } : {}) },
        { new: true, runValidators: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('User not found or admin account cannot be suspended');
    }
    return user;
  }

  getPendingSupplierApplications(): Promise<User[]> {
    return this.userModel
      .find({
        supplierApplicationStatus: SupplierApplicationStatus.Pending,
        status: { $ne: UserStatus.Deleted },
      })
      .sort({ supplierAppliedAt: 1 })
      .exec();
  }

  async getSuppliers(filters: {
    query?: string;
    status?: SupplierApplicationStatus;
  }) {
    const filter: Record<string, unknown> = {
      supplierApplicationStatus: filters.status ?? {
        $in: [
          SupplierApplicationStatus.Pending,
          SupplierApplicationStatus.Approved,
          SupplierApplicationStatus.Rejected,
          SupplierApplicationStatus.Suspended,
        ],
      },
      status: { $ne: UserStatus.Deleted },
    };
    if (filters.query?.trim()) {
      const escaped = filters.query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const search = new RegExp(escaped, 'i');
      filter.$or = [
        { fullName: search },
        { email: search },
        { phone: search },
        { supplierStoreName: search },
        { businessLicenseNumber: search },
      ];
    }
    return this.userModel.find(filter).sort({ supplierAppliedAt: -1 }).exec();
  }

  async getSupplierDetails(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid supplier id');
    }
    const supplier = await this.userModel
      .findOne({
        _id: userId,
        supplierApplicationStatus: { $ne: SupplierApplicationStatus.None },
        status: { $ne: UserStatus.Deleted },
      })
      .exec();
    if (!supplier) throw new NotFoundException('Supplier not found');
    const supplierObjectId = new Types.ObjectId(userId);
    const [products, orders] = await Promise.all([
      this.productModel
        .find({ supplierId: supplierObjectId })
        .sort({ createdAt: -1 })
        .exec(),
      this.connection
        .collection('orders')
        .find({
          $or: [
            { supplierId: supplierObjectId },
            { supplierId: userId },
            { 'items.supplierId': supplierObjectId },
            { 'items.supplierId': userId },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
    ]);
    const revenue = orders.reduce((total, order) => {
      if (['cancelled', 'refunded'].includes(String(order.status))) return total;
      return total + Number(order.supplierRevenue ?? order.totalAmount ?? 0);
    }, 0);
    return {
      supplier,
      statistics: {
        totalProducts: products.length,
        totalOrders: orders.length,
        revenue,
      },
      products,
      orders,
    };
  }

  async reviewSupplierApplication(
    userId: string,
    decision: SupplierReviewDecision,
    note?: string,
  ): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    const approved = decision === SupplierReviewDecision.Approve;
    const requestedInformation =
      decision === SupplierReviewDecision.RequestInformation;
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          supplierApplicationStatus: SupplierApplicationStatus.Pending,
          status: { $ne: UserStatus.Deleted },
        },
        {
          $set: {
            role: approved ? UserRole.Supplier : UserRole.User,
            supplierApplicationStatus:
              approved || requestedInformation
                ? approved
                  ? SupplierApplicationStatus.Approved
                  : SupplierApplicationStatus.Pending
                : SupplierApplicationStatus.Rejected,
            supplierInformationRequired: requestedInformation,
            supplierReviewNote: note?.trim(),
            supplierReviewedAt: new Date(),
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('Pending supplier application not found');
    }
    return user;
  }

  async updateSupplierStatus(
    userId: string,
    action: SupplierStatusAction,
    reason?: string,
  ): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid supplier id');
    }
    const suspended = action === SupplierStatusAction.Suspend;
    const supplier = await this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          supplierApplicationStatus: {
            $in: [
              SupplierApplicationStatus.Approved,
              SupplierApplicationStatus.Suspended,
            ],
          },
          role: UserRole.Supplier,
        },
        {
          $set: {
            status: suspended ? UserStatus.Suspended : UserStatus.Active,
            supplierApplicationStatus: suspended
              ? SupplierApplicationStatus.Suspended
              : SupplierApplicationStatus.Approved,
            supplierReviewNote: reason?.trim(),
            supplierReviewedAt: new Date(),
          },
          ...(suspended ? { $unset: { refreshTokenHash: '' } } : {}),
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!supplier) {
      throw new NotFoundException('Approved or suspended supplier not found');
    }
    return supplier;
  }

  private countUsers(): Promise<number> {
    return this.userModel
      .countDocuments({
        status: { $ne: UserStatus.Deleted },
        deletedAt: { $exists: false },
      })
      .exec();
  }

  private async getMostPopularStyle(): Promise<
    MostPopularStyleAggregation | null
  > {
    const [result] = await this.decorPlanModel
      .aggregate<MostPopularStyleAggregation>([
        {
          $group: {
            _id: '$style',
            total: { $sum: 1 },
          },
        },
        { $sort: { total: -1, _id: 1 } },
        { $limit: 1 },
      ])
      .exec();

    return result ?? null;
  }

  private async getMostSavedDecorPlan(): Promise<
    MostSavedDecorPlanAggregation | null
  > {
    const [result] = await this.favoriteModel
      .aggregate<MostSavedDecorPlanAggregation>([
        {
          $group: {
            _id: '$decorPlanId',
            savedCount: { $sum: 1 },
          },
        },
        { $sort: { savedCount: -1, _id: 1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: 'decor_plans',
            localField: '_id',
            foreignField: '_id',
            as: 'decorPlan',
          },
        },
        {
          $unwind: {
            path: '$decorPlan',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            decorPlanId: '$_id',
            savedCount: 1,
            decorPlan: {
              _id: '$decorPlan._id',
              style: '$decorPlan.style',
              estimatedCost: '$decorPlan.estimatedCost',
              designSuggestion: '$decorPlan.designSuggestion',
            },
          },
        },
      ])
      .exec();

    return result ?? null;
  }

  private toMostPopularStyle(
    result: MostPopularStyleAggregation | null,
  ): DashboardStatisticsResponse['mostPopularStyle'] {
    if (!result) {
      return null;
    }

    return {
      style: result._id,
      totalDecorPlans: result.total,
    };
  }

  private toMostSavedDecorPlan(
    result: MostSavedDecorPlanAggregation | null,
  ): DashboardStatisticsResponse['mostSavedDecorPlan'] {
    if (!result) {
      return null;
    }

    return {
      decorPlanId: result.decorPlanId.toString(),
      savedCount: result.savedCount,
      style: result.decorPlan?.style,
      estimatedCost: result.decorPlan?.estimatedCost,
      designSuggestion: result.decorPlan?.designSuggestion,
    };
  }
}
