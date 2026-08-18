import { Body, Controller, Get, Param, Patch, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { UpdatePayoutDto } from './dto/update-payout.dto';
import { PaymentStatus } from './payment.schema';
import { PaymentsService } from './payments.service';

type AdminRequest = Request & { user?: { sub?: string } };
@ApiTags('Payments') @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @Controller('payments/admin')
export class PaymentsController {
  constructor(private readonly paymentsService:PaymentsService){}
  @Get() @ApiOperation({summary:'Admin: payment history and summary'})
  findAll(@Query('status')status?:PaymentStatus,@Query('method')method?:string,@Query('supplierId')supplierId?:string,@Query('dateFrom')dateFrom?:string,@Query('dateTo')dateTo?:string,@Query('page')page?:string,@Query('limit')limit?:string){return this.paymentsService.findAll({status,method,supplierId,dateFrom,dateTo,page:page?Number(page):undefined,limit:limit?Number(limit):undefined});}
  @Get('supplier-payouts') @ApiOperation({summary:'Admin: supplier payout totals'}) getSupplierPayouts(){return this.paymentsService.getSupplierPayouts();}
  @Get('export') @ApiOperation({summary:'Admin: export payment CSV'}) async exportCsv(@Res()response:Response,@Query('status')status?:PaymentStatus,@Query('method')method?:string,@Query('supplierId')supplierId?:string,@Query('dateFrom')dateFrom?:string,@Query('dateTo')dateTo?:string){const csv=await this.paymentsService.exportCsv({status,method,supplierId,dateFrom,dateTo});response.setHeader('Content-Type','text/csv; charset=utf-8');response.setHeader('Content-Disposition','attachment; filename="decoho-payments.csv"');return response.send(`\uFEFF${csv}`);}
  @Get(':id') findById(@Param('id')id:string){return this.paymentsService.findById(id);}
  @Patch(':id/refund') refund(@Param('id')id:string,@Body()dto:RefundPaymentDto,@Req()request:AdminRequest){return this.paymentsService.refund(id,dto,request.user!.sub!);}
  @Patch(':id/payout') updatePayout(@Param('id')id:string,@Body()dto:UpdatePayoutDto){return this.paymentsService.updatePayout(id,dto.status,dto.note);}
}
