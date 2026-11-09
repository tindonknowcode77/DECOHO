import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Feedback, FeedbackDocument, FeedbackStatus, FeedbackType } from './feedback.schema';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { Product, ProductDocument } from '../products/product.schema';
import { User, UserDocument } from '../users/user.schema';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<FeedbackDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private isValidObjectId(id?: string): boolean {
    if (!id || typeof id !== 'string') return false;
    const clean = id.trim();
    return Types.ObjectId.isValid(clean) && new Types.ObjectId(clean).toString() === clean;
  }

  async create(dto: CreateFeedbackDto, authUserId?: string): Promise<Feedback> {
    let userObjId: Types.ObjectId | undefined;
    let userName = dto.userName?.trim();
    let userEmail = dto.userEmail?.trim();

    if (authUserId && this.isValidObjectId(authUserId)) {
      userObjId = new Types.ObjectId(authUserId);
      const user = await this.userModel.findById(userObjId).lean();
      if (user) {
        if (!userName) userName = user.fullName || user.email;
        if (!userEmail) userEmail = user.email;
      }
    }

    let productObjId: Types.ObjectId | undefined;
    let productName = dto.productName?.trim();

    if (dto.productId && this.isValidObjectId(dto.productId)) {
      productObjId = new Types.ObjectId(dto.productId);
      const prod = await this.productModel.findById(productObjId).lean();
      if (prod && !productName) {
        productName = prod.name;
      }
    }

    const type = dto.type || (productObjId ? FeedbackType.PRODUCT : FeedbackType.WEBSITE);

    const feedback = await this.feedbackModel.create({
      type,
      rating: Number(dto.rating),
      content: dto.content.trim(),
      tags: Array.isArray(dto.tags) ? dto.tags : [],
      productId: productObjId,
      productName,
      userId: userObjId,
      userName: userName || 'Khách trải nghiệm',
      userEmail,
      pageUrl: dto.pageUrl?.trim(),
      status: FeedbackStatus.NEW,
    });

    this.logger.log(`Created feedback #${feedback._id} [${type}] with ${dto.rating} stars`);

    return feedback;
  }

  async getProductFeedback(productId: string) {
    if (!this.isValidObjectId(productId)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ.');
    }

    const pId = new Types.ObjectId(productId);

    const [items, stats] = await Promise.all([
      this.feedbackModel
        .find({ productId: pId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      this.feedbackModel.aggregate([
        { $match: { productId: pId } },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalCount = 0;
    let totalRatingSum = 0;

    stats.forEach((st) => {
      const star = Number(st._id);
      if (star >= 1 && star <= 5) {
        distribution[star] = st.count;
        totalCount += st.count;
        totalRatingSum += star * st.count;
      }
    });

    const averageRating = totalCount > 0 ? Math.round((totalRatingSum / totalCount) * 10) / 10 : 5.0;

    return {
      productId,
      totalCount,
      averageRating,
      distribution,
      items,
    };
  }

  async getAdminFeedback(query: {
    type?: string;
    rating?: number;
    productId?: string;
    status?: string;
    limit?: number;
    page?: number;
  }) {
    const filter: Record<string, any> = {};

    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.rating) filter.rating = Number(query.rating);
    if (query.productId && this.isValidObjectId(query.productId)) {
      filter.productId = new Types.ObjectId(query.productId);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.feedbackModel
        .find(filter)
        .populate('userId', 'fullName email')
        .populate('productId', 'name image priceVND')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.feedbackModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateStatus(id: string, status: FeedbackStatus) {
    if (!this.isValidObjectId(id)) {
      throw new BadRequestException('ID feedback không hợp lệ.');
    }

    const updated = await this.feedbackModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true },
    );

    return updated;
  }
}
