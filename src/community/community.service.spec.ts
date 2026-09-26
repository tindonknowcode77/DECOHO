import { createConnection, Model, Schema, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CommunityService } from './community.service';
import { CommunityFollowDocument, CommunityPost, CommunityPostDocument, CommunityPostSchema } from './community.schema';

describe('CommunityService.deleteOwnPost', () => {
  it.each([true, false])('deletes only the matching owner (owns post: %s)', async ownsPost => {
    const owner = new Types.ObjectId();
    const caller = ownsPost ? owner : new Types.ObjectId();
    const postId = new Types.ObjectId();
    const deleteOne = jest.fn(filter => ({ exec: async () => ({ deletedCount: filter._id.equals(postId) && filter.userId.equals(owner) ? 1 : 0 }) }));
    const service = new CommunityService({ deleteOne } as unknown as Model<CommunityPostDocument>, {} as Model<CommunityFollowDocument>, {} as CloudinaryService);
    if (ownsPost) await expect(service.deleteOwnPost(String(caller), String(postId))).resolves.toEqual({ deleted: true, postId: String(postId) });
    else await expect(service.deleteOwnPost(String(caller), String(postId))).rejects.toMatchObject({ status: 404 });
    expect(deleteOne).toHaveBeenCalledWith({ _id: postId, userId: caller });
  });

  it('rejects invalid IDs without writing', async () => {
    const deleteOne = jest.fn();
    const service = new CommunityService({ deleteOne } as unknown as Model<CommunityPostDocument>, {} as Model<CommunityFollowDocument>, {} as CloudinaryService);
    await expect(service.deleteOwnPost(String(new Types.ObjectId()), 'invalid')).rejects.toMatchObject({ status: 400 });
    expect(deleteOne).not.toHaveBeenCalled();
  });
});

describe('CommunityService.create', () => {
  it.each([
    { description: '   ', roomType: 'Living room', mimetype: 'image/jpeg', size: 1 },
    { description: 'Room', roomType: '  ', mimetype: 'image/jpeg', size: 1 },
    { description: 'Room', roomType: 'Living room', mimetype: 'application/pdf', size: 1 },
    { description: 'Room', roomType: 'Living room', mimetype: 'image/png', size: 11 * 1024 * 1024 },
  ])('rejects invalid content/media before uploading: %j', async ({ description, roomType, mimetype, size }) => {
    const uploadImage = jest.fn();
    const service = new CommunityService({} as Model<CommunityPostDocument>, {} as Model<CommunityFollowDocument>, { uploadImage } as unknown as CloudinaryService);
    await expect(service.create(String(new Types.ObjectId()), { description, roomType }, [{ mimetype, size } as Express.Multer.File])).rejects.toMatchObject({ status: 400 });
    expect(uploadImage).not.toHaveBeenCalled();
  });
  it('returns a populated feed-ready post so the author avatar renders immediately', async () => {
    const userId = new Types.ObjectId();
    const postId = new Types.ObjectId();
    const populated = {
      _id: postId,
      userId: { _id: userId, fullName: 'Test Author' },
      description: 'My room',
      comments: [],
      reactions: [],
      savedBy: [],
    };
    const query = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(populated),
    };
    const posts = {
      create: jest.fn().mockResolvedValue({ _id: postId, userId }),
      findOne: jest.fn().mockReturnValue(query),
    };
    const cloudinary = {
      uploadImage: jest.fn().mockResolvedValue({ secureUrl: 'https://example.com/room.jpg', publicId: 'room' }),
    };
    const service = new CommunityService(
      posts as unknown as Model<CommunityPostDocument>,
      { find: jest.fn().mockReturnValue({ distinct: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }) } as unknown as Model<CommunityFollowDocument>,
      cloudinary as unknown as CloudinaryService,
    );

    const result = await service.create(String(userId), {
      description: 'My room', roomType: 'Living room', hashtags: [],
    }, [{ mimetype: 'image/jpeg' } as Express.Multer.File]);

    expect(result.userId).toMatchObject({ _id: userId, fullName: 'Test Author' });
    expect(result).toMatchObject({ comments: [], commentCount: 0, saved: false, reactionTotal: 0, myReaction: null });
    expect(posts.findOne).toHaveBeenCalledWith({ _id: String(postId), isPublished: true });
  });
});

describe('CommunityService.comment', () => {
  it('rejects whitespace comments without writing to the database', async () => {
    const write = jest.fn();
    const service = new CommunityService({ findByIdAndUpdate: write } as unknown as Model<CommunityPostDocument>, {} as Model<CommunityFollowDocument>, {} as CloudinaryService);
    await expect(service.comment(String(new Types.ObjectId()), String(new Types.ObjectId()), { content: '  ' })).rejects.toMatchObject({ status: 400 });
    expect(write).not.toHaveBeenCalled();
  });
  it.each([false, true])('returns a serializable comment with embedded parent IDs (reply: %s)', async (isReply) => {
    const connection = createConnection();
    const posts = connection.model(CommunityPost.name, CommunityPostSchema);
    const users = connection.model('User', new Schema({ fullName: String }));
    const userId = new Types.ObjectId();
    const postId = new Types.ObjectId();
    const commentId = new Types.ObjectId();
    const parentId = isReply ? new Types.ObjectId() : null;
    const createdAt = new Date();
    const storedPost = {
      _id: postId,
      comments: [{ _id: commentId, userId, content: 'f', parentId, createdAt, reactions: [] }],
    };
    jest.spyOn(posts.collection, 'findOneAndUpdate').mockResolvedValue(storedPost);
    jest.spyOn(posts.collection, 'findOne').mockResolvedValue(storedPost);
    jest.spyOn(posts.collection, 'updateOne').mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null });
    jest.spyOn(users.collection, 'find').mockReturnValue({
      toArray: async () => [{ _id: userId, fullName: 'Test Author' }],
    } as unknown as ReturnType<typeof users.collection.find>);
    const service = new CommunityService(
      posts as unknown as Model<CommunityPostDocument>,
      {} as Model<CommunityFollowDocument>,
      {} as CloudinaryService,
    );

    try {
      const result = await service.comment(String(userId), String(postId), {
        content: 'f', ...(parentId ? { parentId: String(parentId) } : {}),
      });
      expect(JSON.parse(JSON.stringify(result))).toMatchObject({
        _id: String(commentId), content: 'f', createdAt: createdAt.toISOString(),
        userId: { _id: String(userId), fullName: 'Test Author' },
        parentId: parentId ? String(parentId) : null,
        reactionTotal: 0,
      });
    } finally {
      await connection.close();
    }
  });
});
