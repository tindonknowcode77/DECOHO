import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
    MongooseModule.forFeature([
      { name: AffiliateClick.name, schema: AffiliateClickSchema },
      { name: AffiliateOrder.name, schema: AffiliateOrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
