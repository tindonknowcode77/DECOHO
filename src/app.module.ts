import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { DecorPlanModule } from './decor-plans/decor-plan.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ProductsModule } from './products/products.module';
import { RoomsModule } from './rooms/rooms.module';
import { UsersModule } from './users/users.module';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

@Module({
  imports: [
    MongooseModule.forRoot(getRequiredEnv('MONGODB_URI'), {
      serverSelectionTimeoutMS: 10000,
    }),
    AuthModule,
    UsersModule,
    RoomsModule,
    AiModule,
    ProductsModule,
    DecorPlanModule,
    FavoritesModule,
    AdminModule,
    CloudinaryModule,
  ],
})
export class AppModule {}
