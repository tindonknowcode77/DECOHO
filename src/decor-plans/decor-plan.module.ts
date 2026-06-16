import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { RoomsModule } from '../rooms/rooms.module';
import { DecorPlanController } from './decor-plan.controller';
import { DecorPlan, DecorPlanSchema } from './decor-plan.schema';
import { DecorPlanService } from './decor-plan.service';

@Module({
  imports: [
    AuthModule,
    AiModule,
    ProductsModule,
    RoomsModule,
    MongooseModule.forFeature([
      { name: DecorPlan.name, schema: DecorPlanSchema },
    ]),
  ],
  controllers: [DecorPlanController],
  providers: [DecorPlanService],
  exports: [DecorPlanService],
})
export class DecorPlanModule {}
