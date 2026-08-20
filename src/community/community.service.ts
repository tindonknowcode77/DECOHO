import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateCommunityCommentDto, CreateCommunityPostDto } from './dto/community.dto';
import { CommunityFollow, CommunityFollowDocument, CommunityPost, CommunityPostDocument } from './community.schema';

@Injectable()
export class CommunityService {
  constructor(
    @InjectModel(CommunityPost.name) private readonly posts: Model<CommunityPostDocument>,
    @InjectModel(CommunityFollow.name) private readonly follows: Model<CommunityFollowDocument>,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async feed(tab = 'for-you', page = 1, limit = 10, userId?: string) {
    const filter: Record<string, unknown> = { isPublished: true };
    if (tab === 'makeovers') filter.beforeImageUrl = { $exists: true };
    if (tab === 'tips') filter.hashtags = /tips/i;
    if ((tab === 'following' || tab === 'saved') && !userId) throw new BadRequestException('Please sign in');
    if (tab === 'following' && userId) filter.userId = { $in: await this.followingIds(userId) };
    if (tab === 'saved' && userId) filter.savedBy = new Types.ObjectId(userId);

    const sort = tab === 'trending' ? { likedBy: -1 as const, createdAt: -1 as const } : { createdAt: -1 as const };
    const [items, total, followed] = await Promise.all([
      this.posts.find(filter).populate('userId', 'fullName avatar businessAddress preferences').populate('comments.userId', 'fullName avatar').sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.posts.countDocuments(filter),
      userId ? this.followingIds(userId) : Promise.resolve([]),
    ]);
    const followingIds = new Set(followed.map(String));
    return { items: items.map((item) => this.view(item, userId, followingIds)), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(userId: string, dto: CreateCommunityPostDto, files: { before?: Express.Multer.File[]; after?: Express.Multer.File[] }) {
    this.id(userId);
    const before = files.before?.[0];
    const after = files.after?.[0];
    if (!before || !after) throw new BadRequestException('Before and after images are required');
    const [a, b] = await Promise.all([this.cloudinary.uploadImage(before, 'decoho/community'), this.cloudinary.uploadImage(after, 'decoho/community')]);
    return this.posts.create({ userId: new Types.ObjectId(userId), description: dto.description.trim(), roomType: dto.roomType.trim(), hashtags: (dto.hashtags ?? []).map((x) => x.replace(/^#/, '').trim()).filter(Boolean), beforeImageUrl: a.secureUrl, afterImageUrl: b.secureUrl, beforeImagePublicId: a.publicId, afterImagePublicId: b.publicId });
  }

  toggleLike(userId: string, postId: string) { return this.toggle(postId, userId, 'likedBy'); }
  toggleSave(userId: string, postId: string) { return this.toggle(postId, userId, 'savedBy'); }

  async comment(userId: string, postId: string, dto: CreateCommunityCommentDto) {
    this.id(userId); this.id(postId);
    const post = await this.posts.findByIdAndUpdate(postId, { $push: { comments: { userId: new Types.ObjectId(userId), content: dto.content.trim() } } }, { new: true }).populate('comments.userId', 'fullName avatar').exec();
    if (!post) throw new NotFoundException('Community post not found');
    return post.comments.at(-1);
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
    return this.posts.aggregate([{ $match: { isPublished: true } }, { $group: { _id: '$userId', posts: { $sum: 1 }, likes: { $sum: { $size: '$likedBy' } } } }, { $sort: { likes: -1, posts: -1 } }, { $limit: 8 }, { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } }, { $unwind: '$user' }, { $project: { _id: 0, userId: '$_id', fullName: '$user.fullName', avatar: '$user.avatar', posts: 1, likes: 1 } }]).exec();
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
    const likes = (item.likedBy as Types.ObjectId[] | undefined) ?? [];
    const saves = (item.savedBy as Types.ObjectId[] | undefined) ?? [];
    const author = item.userId as { _id?: Types.ObjectId } | undefined;
    return { ...item, userId: author ? { ...author, following: author._id ? followed.has(String(author._id)) : false } : author, likeCount: likes.length, commentCount: ((item.comments as unknown[] | undefined) ?? []).length, liked: userId ? likes.some((id) => id.toString() === userId) : false, saved: userId ? saves.some((id) => id.toString() === userId) : false, likedBy: undefined, savedBy: undefined };
  }

  private id(id: string) { if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id'); }
}
