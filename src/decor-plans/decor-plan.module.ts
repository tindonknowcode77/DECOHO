import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DecorPlan, DecorPlanSchema } from './decor-plan.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: DecorPlan.name, schema: DecorPlanSchema }])],
  exports: [MongooseModule],
})
export class DecorPlanModule {}
