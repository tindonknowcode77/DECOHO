import 'reflect-metadata';
import { Types } from 'mongoose';
import { validate } from 'class-validator';
import { RoomsService } from './rooms.service';
import { ROOM_KIND_MOODBOARD } from './room.schema';
import { DeleteProductSpacesDto } from './dto/delete-product-spaces.dto';
import { ProductSpacesController } from './product-spaces.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

describe('Admin moodboard deletion', () => {
  const deleteMany = jest.fn().mockResolvedValue({ deletedCount: 2 });
  const service = Object.create(RoomsService.prototype) as RoomsService;
  Object.assign(service, { roomModel: { collection: { deleteMany } } });
  beforeEach(() => deleteMany.mockClear());

  it('restricts deletes to moodboards and supports legacy and ObjectId identifiers', async () => {
    const id = new Types.ObjectId().toHexString();
    await expect(service.deleteProductSpaces(['MB-001', id, id])).resolves.toEqual({ deletedCount: 2 });
    const filter = deleteMany.mock.calls[0][0];
    expect(filter.kind).toBe(ROOM_KIND_MOODBOARD);
    expect(filter._id.$in.map(String)).toEqual(['MB-001', id, id]);
    expect(filter._id.$in[2]).toBeInstanceOf(Types.ObjectId);
  });

  it.each([{ ids: [] }, { ids: [' '] }, { ids: Array(101).fill('x') }])('rejects invalid selections before writing', async ({ ids }) => {
    await expect(service.deleteProductSpaces(ids)).rejects.toThrow();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('validates DTO and protects both endpoints with auth and role guards', async () => {
    const dto = Object.assign(new DeleteProductSpacesDto(), { ids: ['same', 'same'] });
    expect((await validate(dto)).length).toBeGreaterThan(0);
    for (const handler of [ProductSpacesController.prototype.deleteMany, ProductSpacesController.prototype.deleteOne]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([JwtAuthGuard, RolesGuard]);
    }
  });
});
