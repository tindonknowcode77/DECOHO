import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Product, ProductSchema } from '../products/product.schema';
import { User, UserSchema } from '../users/user.schema';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import {
  AffiliateClick,
  AffiliateClickSchema,
} from './schemas/affiliate-click.schema';
import {
  AffiliateOrder,
  AffiliateOrderSchema,
} from './schemas/affiliate-order.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: AffiliateClick.name, schema: AffiliateClickSchema },
      { name: AffiliateOrder.name, schema: AffiliateOrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
