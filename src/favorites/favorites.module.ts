import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Favorite, FavoriteSchema } from './favorite.schema';
import { ProductFavorite, ProductFavoriteSchema } from './product-favorite.schema';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { ProductFavoritesService } from './product-favorites.service';
import { ProductFavoritesController } from './product-favorites.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Favorite.name, schema: FavoriteSchema }]),
    MongooseModule.forFeature([{ name: ProductFavorite.name, schema: ProductFavoriteSchema }]),
  ],
  controllers: [FavoritesController, ProductFavoritesController],
  providers: [FavoritesService, ProductFavoritesService],
  exports: [MongooseModule, FavoritesService, ProductFavoritesService],
})
export class FavoritesModule {}
