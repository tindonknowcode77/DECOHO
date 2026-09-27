import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Model, Types } from 'mongoose';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityPostDocument, CommunityFollowDocument } from './community.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('Community administration', () => {
  it.each(['adminPosts', 'setVisibility'] as const)('protects %s with authentication and role checks', method => {
    const handler = CommunityController.prototype[method];
    expect(Reflect.getMetadata('__guards__', handler)).toEqual([JwtAuthGuard, RolesGuard]);
    const guard = new RolesGuard(new Reflector());
    for (const role of ['USER', 'SUPPLIER', undefined, 'ADMIN', 'SUPER_ADMIN', 'STAFF']) {
      const context = { getHandler: () => handler, getClass: () => CommunityController, switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) } as unknown as ExecutionContext;
      if (role && ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(role)) expect(guard.canActivate(context)).toBe(true);
      else expect(() => guard.canActivate(context)).toThrow('Insufficient role permissions');
    }
  });

  it('filters hidden posts and escapes search characters', async () => {
    const query = { populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]) };
    const posts = { find: jest.fn().mockReturnValue(query), countDocuments: jest.fn().mockResolvedValue(0) };
    const service = new CommunityService(posts as unknown as Model<CommunityPostDocument>, {} as Model<CommunityFollowDocument>, {} as CloudinaryService);
    await expect(service.adminPosts('.*', 'hidden', -2)).resolves.toMatchObject({ items: [], page: 1, total: 0 });
    expect(posts.find).toHaveBeenCalledWith({ isPublished: false, $or: ['description', 'roomType', 'hashtags'].map(key => ({ [key]: { $regex: '\\.\\*', $options: 'i' } })) });
    await expect(service.adminPosts('', 'unknown')).rejects.toMatchObject({ status: 400 });
  });

  it.each([false, true])('changes visibility to %s and handles missing posts', async isPublished => {
    const id = String(new Types.ObjectId());
    const query = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue({ _id: id, isPublished }) };
    const posts = { findByIdAndUpdate: jest.fn().mockReturnValue(query) };
    const service = new CommunityService(posts as unknown as Model<CommunityPostDocument>, {} as Model<CommunityFollowDocument>, {} as CloudinaryService);
    await expect(service.setVisibility(id, isPublished)).resolves.toEqual({ _id: id, isPublished });
    expect(posts.findByIdAndUpdate).toHaveBeenCalledWith(id, { $set: { isPublished } }, { new: true });
    query.exec.mockResolvedValue(null);
    await expect(service.setVisibility(id, isPublished)).rejects.toMatchObject({ status: 404 });
    await expect(service.setVisibility('invalid', isPublished)).rejects.toMatchObject({ status: 400 });
  });
});
