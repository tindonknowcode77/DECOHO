import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateCommunityCommentDto, CreateCommunityPostDto } from './dto/community.dto';
import { CommunityFollow, CommunityFollowDocument, CommunityPost, CommunityPostDocument } from './community.schema';

const MAX_MEDIA = 10;

@Injectable()
export class CommunityService {
  constructor(
    @InjectModel(CommunityPost.name) private readonly posts: Model<CommunityPostDocument>,
    @InjectModel(CommunityFollow.name) private readonly follows: Model<CommunityFollowDocument>,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async feed(tab = 'for-you', page = 1, limit = 10, userId?: string) {
    const filter: Record<string, unknown> = { isPublished: true };
    if (tab === 'makeovers') filter['media.type'] = { $exists: true };
    if (tab === 'tips') filter.hashtags = /tips/i;
    if ((tab === 'following' || tab === 'saved') && !userId) throw new BadRequestException('Please sign in');
    if (tab === 'following' && userId) filter.userId = { $in: await this.followingIds(userId) };
    if (tab === 'saved' && userId) filter.savedBy = new Types.ObjectId(userId);

    const sort = tab === 'trending' ? { 'reactions._id': -1 as const, createdAt: -1 as const } : { createdAt: -1 as const };
    const [items, total, followed] = await Promise.all([
      this.posts.find(filter).populate('userId', 'fullName avatar businessAddress preferences').populate('comments.userId', 'fullName avatar').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.posts.countDocuments(filter),
      userId ? this.followingIds(userId) : Promise.resolve([]),
    ]);
    const followingIds = new Set(followed.map(String));
    return { items: items.map((item) => this.view(item, userId, followingIds)), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(userId: string, dto: CreateCommunityPostDto, files: Express.Multer.File[]) {
    this.id(userId);
    if (!files?.length) throw new BadRequestException('At least one image or video is required');
    if (files.length > MAX_MEDIA) throw new BadRequestException(`Maximum ${MAX_MEDIA} media files allowed`);

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const isVideo = file.mimetype.startsWith('video/');
        const result = isVideo
          ? await this.cloudinary.uploadVideo(file, 'decoho/community')
          : await this.cloudinary.uploadImage(file, 'decoho/community');
        return {
          url: result.secureUrl,
          publicId: result.publicId,
          type: isVideo ? ('video' as const) : ('image' as const),
          thumbnailUrl: result.thumbnailUrl ?? result.secureUrl,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        };
      }),
    );

    return this.posts.create({
      userId: new Types.ObjectId(userId),
      description: dto.description.trim(),
      roomType: dto.roomType.trim(),
      hashtags: (dto.hashtags ?? []).map((x) => x.replace(/^#/, '').trim()).filter(Boolean),
      media: uploaded,
    });
  }

  react(userId: string, postId: string, type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry') {
    return this.reactOn(userId, postId, null, type);
  }

  reactComment(userId: string, postId: string, commentId: string, type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry') {
    return this.reactOn(userId, postId, commentId, type);
  }

  private async reactOn(userId: string, postId: string, commentId: string | null, type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry') {
    this.id(userId); this.id(postId);
    if (commentId) this.id(commentId);
    const oid = new Types.ObjectId(userId);
    const arrayPath = commentId ? 'comments.$.reactions' : 'reactions';
    const matchPath = commentId ? 'comments._id' : '_id';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { _id: new Types.ObjectId(postId), [matchPath]: commentId ? new Types.ObjectId(commentId) : new Types.ObjectId(postId) };
    const post = await this.posts.findOne(query).exec();
    if (!post) throw new NotFoundException(commentId ? 'Comment not found' : 'Community post not found');
    const list = commentId
      ? ((post.comments as unknown as Array<{ _id: Types.ObjectId; reactions?: { type: string; userId: Types.ObjectId }[] }>).find((c) => c._id.toString() === commentId)?.reactions ?? [])
      : (post.reactions ?? []);
    const existed = list.find((r) => r.userId.toString() === userId);
    let updated;
    if (!existed) {
      updated = await this.posts.updateOne(query, { $push: { [arrayPath]: { type, userId: oid } } }).exec();
    } else if (existed.type === type) {
      updated = await this.posts.updateOne(query, { $pull: { [arrayPath]: existed } }).exec();
      type = null;
    } else {
      updated = await this.posts.updateOne(query, { $set: { [`${arrayPath}.$[r].type`]: type } }, { arrayFilters: [{ 'r.userId': oid }] }).exec();
    }
    if (!updated.acknowledged) throw new NotFoundException('Reaction update failed');
    return this.reactionSummary(postId, commentId, userId, type);
  }

  private async reactionSummary(postId: string, commentId: string | null, userId: string, currentType: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry' | null) {
    const projection = commentId
      ? { $reduce: { input: '$comments', as: 'c', initialValue: { items: [] }, in: { $cond: [{ $eq: ['$$c._id', { $toObjectId: commentId }] }, { items: '$$c.reactions' }, '$$value'] } } }
      : '$reactions';
    const agg = await this.posts.aggregate([
      { $match: { _id: new Types.ObjectId(postId) } },
      { $project: { items: projection } },
    ]).exec();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: { type: string; userId: Types.ObjectId }[] = (((agg[0] as any)?.items?.items) ?? (agg[0] as any)?.items ?? []) as { type: string; userId: Types.ObjectId }[];
    const counts: Record<string, number> = {};
    items.forEach((r) => { counts[r.type] = (counts[r.type] ?? 0) + 1; });
    const my = items.find((r) => r.userId.toString() === userId);
    return {
      active: currentType !== null,
      myType: currentType,
      counts,
      total: items.length,
    };
  }

  async comment(userId: string, postId: string, dto: CreateCommunityCommentDto) {
    this.id(userId); this.id(postId);
    if (dto.parentId && !Types.ObjectId.isValid(dto.parentId)) throw new BadRequestException('Invalid parent comment id');
    const userObjectId = new Types.ObjectId(userId);
    const payload: Record<string, unknown> = { userId: userObjectId, content: dto.content.trim() };
    if (dto.parentId) {
      const parent = await this.posts.findOne({ _id: postId, 'comments._id': new Types.ObjectId(dto.parentId) }).exec();
      if (!parent) throw new NotFoundException('Parent comment not found');
      payload.parentId = new Types.ObjectId(dto.parentId);
    }
    const post = await this.posts.findByIdAndUpdate(postId, { $push: { comments: payload } }, { new: true })
      .populate('comments.userId', 'fullName avatar')
      .populate('comments.parentId', '_id')
      .exec();
    if (!post) throw new NotFoundException('Community post not found');
    // bump replyCount của parent
    if (dto.parentId) {
      await this.posts.updateOne({ _id: postId, 'comments._id': new Types.ObjectId(dto.parentId) }, { $inc: { 'comments.$.replyCount': 1 } }).exec();
    }
    const last = post.comments.at(-1);
    return this.commentView(last as unknown as Record<string, unknown>, userId);
  }

  async toggleCommentLike(userId: string, postId: string, commentId: string) {
    return this.reactComment(userId, postId, commentId, 'like');
  }

  async getById(postId: string, userId?: string) {
    this.id(postId);
    const post = await this.posts.findOne({ _id: postId, isPublished: true })
      .populate('userId', 'fullName avatar businessAddress preferences')
      .populate('comments.userId', 'fullName avatar')
      .populate('comments.parentId', '_id')
      .lean()
      .exec();
    if (!post) throw new NotFoundException('Community post not found');
    const followingIds = userId ? new Set((await this.followingIds(userId)).map(String)) : new Set<string>();
    return this.view(post, userId, followingIds);
  }

  async getComments(postId: string, userId: string | undefined, parentId: string | undefined, page: number, limit: number) {
    this.id(postId);
    if (parentId) this.id(parentId);
    const matchParent = parentId ? new Types.ObjectId(parentId) : null;
    const filtered = await this.posts.aggregate([
      { $match: { _id: new Types.ObjectId(postId), isPublished: true } },
      { $project: { comments: { $filter: { input: '$comments', as: 'c', cond: matchParent ? { $eq: ['$$c.parentId', matchParent] } : { $eq: [{ $ifNull: ['$$c.parentId', null] }, null] } } } } },
      { $unwind: { path: '$comments', preserveNullAndEmptyArrays: false } },
      { $sort: { 'comments.createdAt': -1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $lookup: { from: 'users', localField: 'comments.userId', foreignField: '_id', as: 'comments.userId' } },
            { $unwind: { path: '$comments.userId', preserveNullAndEmptyArrays: true } },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]).exec();
    const facet = filtered[0] ?? { items: [], total: [] };
    const items = (facet.items as unknown[]).map((row) => (row as { comments: Record<string, unknown> }).comments);
    const total = (facet.total as { count: number }[])[0]?.count ?? 0;
    return {
      items: items.map((c) => this.commentView(c, userId)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async search(q: string, page: number, limit: number, userId?: string) {
    const term = (q ?? '').trim();
    if (!term) return { items: [], total: 0, page, limit, totalPages: 0 };
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const filter: Record<string, unknown> = {
      isPublished: true,
      $or: [
        { description: regex },
        { hashtags: regex },
        { roomType: regex },
      ],
    };
    const [items, total] = await Promise.all([
      this.posts.find(filter)
        .populate('userId', 'fullName avatar businessAddress preferences')
        .populate('comments.userId', 'fullName avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.posts.countDocuments(filter),
    ]);
    const followed = userId ? new Set((await this.followingIds(userId)).map(String)) : new Set<string>();
    return {
      items: items.map((item) => this.view(item, userId, followed)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async toggleFollow(userId: string, targetId: string) {
    this.id(userId); this.id(targetId);
    if (userId === targetId) throw new BadRequestException('Cannot follow yourself');
    const query = { followerId: new Types.ObjectId(userId), followingId: new Types.ObjectId(targetId) };
    const existing = await this.follows.findOneAndDelete(query).exec();
    if (existing) return { following: false };
    await this.follows.create(query);
    return { following: true };
  }

  async getFollowingIds(userId: string) { return { userIds: (await this.followingIds(userId)).map(String) }; }

  async creators() {
    return this.posts.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$userId', posts: { $sum: 1 }, likes: { $sum: { $size: '$reactions' } } } },
      { $sort: { likes: -1, posts: -1 } },
      { $limit: 8 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, userId: '$_id', fullName: '$user.fullName', avatar: '$user.avatar', posts: 1, likes: 1 } },
    ]).exec();
  }

  private followingIds(userId: string): Promise<Types.ObjectId[]> {
    this.id(userId);
    return this.follows.find({ followerId: new Types.ObjectId(userId) }).distinct('followingId').exec() as Promise<Types.ObjectId[]>;
  }

  private async toggle(postId: string, userId: string, field: 'likedBy' | 'savedBy') {
    this.id(postId); this.id(userId);
    const post = await this.posts.findById(postId).exec();
    if (!post) throw new NotFoundException('Community post not found');
    const exists = post[field].some((id) => id.toString() === userId);
    await this.posts.updateOne({ _id: postId }, exists ? { $pull: { [field]: new Types.ObjectId(userId) } } : { $addToSet: { [field]: new Types.ObjectId(userId) } }).exec();
    return { active: !exists, count: post[field].length + (exists ? -1 : 1) };
  }

  private view(item: Record<string, unknown>, userId?: string, followed = new Set<string>()) {
    const reactions = (item.reactions as { type: string; userId: Types.ObjectId }[] | undefined) ?? [];
    const saves = (item.savedBy as Types.ObjectId[] | undefined) ?? [];
    const author = item.userId as { _id?: Types.ObjectId } | undefined;
    const reactionCounts: Record<string, number> = {};
    reactions.forEach((r) => { reactionCounts[r.type] = (reactionCounts[r.type] ?? 0) + 1; });
    const my = reactions.find((r) => r.userId.toString() === userId);
    return {
      ...item,
      userId: author ? { ...author, following: author._id ? followed.has(String(author._id)) : false } : author,
      reactionCounts,
      myReaction: my?.type ?? null,
      reactionTotal: reactions.length,
      commentCount: ((item.comments as unknown[] | undefined) ?? []).length,
      saved: userId ? saves.some((id) => id.toString() === userId) : false,
      likedBy: undefined,
      savedBy: undefined,
      reactions: undefined,
    };
  }

  private id(id: string) { if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id'); }

  private commentView(item: Record<string, unknown>, userId?: string) {
    const reactions = (item.reactions as { type: string; userId: Types.ObjectId }[] | undefined) ?? [];
    const user = item.userId as { _id?: Types.ObjectId; fullName?: string; avatar?: string } | undefined;
    const counts: Record<string, number> = {};
    reactions.forEach((r) => { counts[r.type] = (counts[r.type] ?? 0) + 1; });
    const my = reactions.find((r) => r.userId.toString() === userId);
    return {
      ...item,
      userId: user?._id ? { _id: user._id, fullName: user.fullName, avatar: user.avatar } : user,
      reactionCounts: counts,
      myReaction: my?.type ?? null,
      reactionTotal: reactions.length,
      reactions: undefined,
    };
  }
}
