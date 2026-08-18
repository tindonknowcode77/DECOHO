import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Product, ProductSchema } from '../products/product.schema';
import { Order, OrderSchema } from './order.schema';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [AuthModule, PromotionsModule, MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }, { name: Product.name, schema: ProductSchema }])],
  controllers: [OrdersController], providers: [OrdersService], exports: [OrdersService],
})
export class OrdersModule {}
