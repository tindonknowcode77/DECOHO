import { UnauthorizedException } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { ProductFavoritesController } from './product-favorites.controller';
import { ProductFavoritesService } from './product-favorites.service';

describe('Favorite controllers JWT identity', () => {
  const getIds = jest.fn().mockResolvedValue([]);
  const controllers = [
    new FavoritesController({ getIds } as unknown as FavoritesService),
    new ProductFavoritesController({ getIds } as unknown as ProductFavoritesService),
  ];

  it.each(controllers)('uses the authenticated JWT subject in %p', async (controller) => {
    const request = { user: { sub: '64b000000000000000000001' } } as Parameters<typeof controller.getIds>[0];
    await controller.getIds(request);
    expect(getIds).toHaveBeenLastCalledWith(request.user.sub);
  });

  it.each(controllers)('returns unauthorized when the identity is missing in %p', async (controller) => {
    const request = { user: {} } as Parameters<typeof controller.getIds>[0];
    await expect(controller.getIds(request)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
