import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Order, OrderSchema } from '../orders/order.schema';
import { Payment, PaymentSchema } from '../payments/payment.schema';
import { Product, ProductSchema } from '../products/product.schema';
import { Review, ReviewSchema } from '../reviews/review.schema';
import { User, UserSchema } from '../users/user.schema';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [AuthModule, MongooseModule.forFeature([
    { name: User.name, schema: UserSchema }, { name: Product.name, schema: ProductSchema },
    { name: Order.name, schema: OrderSchema }, { name: Payment.name, schema: PaymentSchema },
    { name: Review.name, schema: ReviewSchema },
  ])],
  controllers: [SuppliersController], providers: [SuppliersService], exports: [SuppliersService],
})
export class SuppliersModule {}
