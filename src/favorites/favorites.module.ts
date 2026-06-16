import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import {
  DecorPlan,
  DecorPlanSchema,
} from '../decor-plans/decor-plan.schema';
import { Favorite, FavoriteSchema } from './favorite.schema';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Favorite.name, schema: FavoriteSchema },
      { name: DecorPlan.name, schema: DecorPlanSchema },
    ]),
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
