import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Promotion, PromotionSchema } from './promotion.schema';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({imports:[AuthModule,MongooseModule.forFeature([{name:Promotion.name,schema:PromotionSchema}])],controllers:[PromotionsController],providers:[PromotionsService],exports:[PromotionsService]})
export class PromotionsModule{}
