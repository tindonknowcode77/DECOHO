import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Order, OrderSchema } from '../orders/order.schema';
import { Payment, PaymentSchema } from './payment.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports:[AuthModule,MongooseModule.forFeature([{name:Payment.name,schema:PaymentSchema},{name:Order.name,schema:OrderSchema}])],
  controllers:[PaymentsController],providers:[PaymentsService],exports:[PaymentsService],
})
export class PaymentsModule{}
