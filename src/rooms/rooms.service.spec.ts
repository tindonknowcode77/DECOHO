import { Model, Mongoose, Types } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { Room, RoomDocument, RoomSchema } from './room.schema';
import { Product, ProductDocument, ProductSchema } from '../products/product.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

describe('Moodboard legacy IDs', () => {
  const mongoose = new Mongoose();
  const rooms = mongoose.model(Room.name, RoomSchema);
  const products = mongoose.model(Product.name, ProductSchema);
  const service = new RoomsService(
    rooms as unknown as Model<RoomDocument>,
    products as unknown as Model<ProductDocument>,
    {} as CloudinaryService,
  );
  const productId = new Types.ObjectId();

  afterEach(() => jest.restoreAllMocks());

  it('loads imported boards while populating valid products and ignoring broken references', async () => {
    jest.spyOn(rooms.collection, 'aggregate').mockReturnValue({
      toArray: async () => [{
        _id: 'MB-PG-001', kind: 'moodboard', isPublic: true,
        productPoints: [
          { _id: 'old-point', productId: 'prod_MB-PG-001-SP01', x: 10, y: 20 },
          { _id: new Types.ObjectId(), productId, x: 30, y: 40 },
        ],
      }],
    } as never);
    const find = jest.spyOn(products.collection, 'find').mockReturnValue({
      toArray: async () => [{ _id: productId, name: 'Chair', price: 100 }],
    } as never);

    const result = await service.getProductSpaces(true);
    expect(result[0]._id).toBe('MB-PG-001');
    expect(result[0].productPoints[0].productId).toBeNull();
    expect(result[0].productPoints[1].productId).toMatchObject({ name: 'Chair' });
    expect(find.mock.calls[0][0]).toMatchObject({ _id: { $in: [productId] } });
  });

  it('opens legacy IDs while requiring a public moodboard', async () => {
    const aggregate = jest.spyOn(rooms.collection, 'aggregate').mockReturnValue({
      toArray: async () => [{ _id: 'MB-PG-001', productPoints: [] }],
    } as never);
    expect((await service.getPublicProductSpace('MB-PG-001'))._id).toBe('MB-PG-001');
    expect(aggregate.mock.calls[0][0][0]).toEqual({
      $match: { _id: { $in: ['MB-PG-001'] }, kind: 'moodboard', isPublic: true },
    });
  });

  it('returns 404 for a missing board', async () => {
    jest.spyOn(rooms.collection, 'aggregate').mockReturnValue({
      toArray: async () => [],
    } as never);
    await expect(service.getPublicProductSpace('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
