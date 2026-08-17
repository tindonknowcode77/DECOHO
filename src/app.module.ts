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
import { AiScannerModule } from './ai-scanner/ai-scanner.module';
import { CategoriesModule } from './categories/categories.module';
import { BrandsModule } from './brands/brands.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PromotionsModule } from './promotions/promotions.module';
import { ShowroomsModule } from './showrooms/showrooms.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { WebsiteContentModule } from './website-content/website-content.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { SearchModule } from './search/search.module';
import { CommunityModule } from './community/community.module';
import { AppController } from './app.controller';

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
    AiScannerModule,
    CategoriesModule,
    BrandsModule,
    OrdersModule,
    PaymentsModule,
    PromotionsModule,
    ShowroomsModule,
    ReviewsModule,
    SupportTicketsModule,
    WebsiteContentModule,
    SuppliersModule,
    SearchModule,
    CommunityModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
