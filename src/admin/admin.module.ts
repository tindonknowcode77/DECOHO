import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import {
  DecorPlan,
  DecorPlanSchema,
} from '../decor-plans/decor-plan.schema';
import { Favorite, FavoriteSchema } from '../favorites/favorite.schema';
import { Room, RoomSchema } from '../rooms/room.schema';
import { User, UserSchema } from '../users/user.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: DecorPlan.name, schema: DecorPlanSchema },
      { name: Favorite.name, schema: FavoriteSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
