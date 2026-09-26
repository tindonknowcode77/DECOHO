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

  it.each(['MB-PG-001', new Types.ObjectId()])('edits metadata and points for board %s', async (boardId) => {
    const pointId = typeof boardId === 'string' ? 'MB-PG-001-PT01' : new Types.ObjectId();
    const raw = { _id: boardId, productPoints: [{ _id: pointId }] };
    jest.spyOn(rooms.collection, 'aggregate').mockReturnValue({ toArray: async () => [raw] } as never);
    jest.spyOn(rooms, 'populate').mockImplementation(async docs => docs as never);
    jest.spyOn(products, 'exists').mockResolvedValue({ _id: productId } as never);
    const update = jest.spyOn(rooms.collection, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);
    const dto = { productId: String(productId), x: 25, y: 50 };
    await service.addProductPoint(String(boardId), dto);
    expect(update.mock.calls[0][0]).toEqual({ _id: boardId, kind: 'moodboard' });
    expect(update.mock.calls[0][1]).toMatchObject({ $push: { productPoints: { _id: expect.any(Types.ObjectId), productId, x: 25, y: 50 } } });
    await service.updateProductPoint(String(boardId), String(pointId), dto);
    expect(update.mock.calls[1][0]).toMatchObject({ _id: boardId, 'productPoints._id': pointId });
    await service.deleteProductPoint(String(boardId), String(pointId));
    expect(update.mock.calls[2][1]).toMatchObject({ $pull: { productPoints: { _id: pointId } } });
    await service.updateProductSpace(String(boardId), { title: 'Updated' });
    expect(update.mock.calls[3][1]).toMatchObject({ $set: { title: 'Updated' } });
  });

  it('rejects invalid coordinates without writing', async () => {
    jest.spyOn(rooms.collection, 'aggregate').mockReturnValue({ toArray: async () => [{ _id: 'MB-PG-001' }] } as never);
    const update = jest.spyOn(rooms.collection, 'updateOne');
    await expect(service.addProductPoint('MB-PG-001', { productId: String(productId), x: 101, y: 0 })).rejects.toThrow('Point coordinates');
    expect(update).not.toHaveBeenCalled();
  });

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

  it('updates only image metadata for a legacy board and preserves product points', async () => {
    const room = { _id: 'MB-PG-001', productPoints: [], isPublic: false };
    jest.spyOn(rooms.collection, 'aggregate').mockReturnValue({ toArray: async () => [room] } as never);
    const update = jest.spyOn(rooms.collection, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);
    const uploadImage = jest.fn().mockResolvedValue({ secureUrl: 'https://example.org/new.jpg', publicId: 'new-image', width: 100, height: 80, bytes: 500, format: 'jpg' });
    const imageService = new RoomsService(rooms as unknown as Model<RoomDocument>, products as unknown as Model<ProductDocument>, { uploadImage } as unknown as CloudinaryService);
    await imageService.updateProductSpaceImage('MB-PG-001', {} as Express.Multer.File);
    expect(update.mock.calls[0][0]).toEqual({ _id: 'MB-PG-001', kind: 'moodboard' });
    expect(update.mock.calls[0][1]).toMatchObject({ $set: { imageUrl: 'https://example.org/new.jpg' } });
    expect(update.mock.calls[0][1]).not.toHaveProperty('$set.productPoints');
    expect(update.mock.calls[0][1]).not.toHaveProperty('$set.isPublic');
  });

  it('does not upload an image for a missing board', async () => {
    jest.spyOn(rooms.collection, 'aggregate').mockReturnValue({ toArray: async () => [] } as never);
    const uploadImage = jest.fn();
    const imageService = new RoomsService(rooms as unknown as Model<RoomDocument>, products as unknown as Model<ProductDocument>, { uploadImage } as unknown as CloudinaryService);
    await expect(imageService.updateProductSpaceImage('missing', {} as Express.Multer.File)).rejects.toBeInstanceOf(NotFoundException);
    expect(uploadImage).not.toHaveBeenCalled();
  });
});
