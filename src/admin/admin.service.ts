import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DecorPlan,
  DecorPlanDocument,
} from '../decor-plans/decor-plan.schema';
import { Favorite, FavoriteDocument } from '../favorites/favorite.schema';
import { Room, RoomDocument } from '../rooms/room.schema';
import { User, UserDocument, UserStatus } from '../users/user.schema';

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
  ) {}

  async getDashboardStatistics(): Promise<DashboardStatisticsResponse> {
    const [
      totalUsers,
      totalRooms,
      totalDecorPlans,
      mostPopularStyleResult,
      mostSavedDecorPlanResult,
    ] = await Promise.all([
      this.countUsers(),
      this.roomModel.countDocuments().exec(),
      this.decorPlanModel.countDocuments().exec(),
      this.getMostPopularStyle(),
      this.getMostSavedDecorPlan(),
    ]);

    return {
      totalUsers,
      totalRooms,
      totalDecorPlans,
      mostPopularStyle: this.toMostPopularStyle(mostPopularStyleResult),
      mostSavedDecorPlan: this.toMostSavedDecorPlan(
        mostSavedDecorPlanResult,
      ),
    };
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
