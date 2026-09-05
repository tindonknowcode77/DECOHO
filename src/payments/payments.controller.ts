import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type AuthRequest = Request & { user?: { sub?: string } };

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly bankInfo = {
    bankName: 'Vietcombank',
    accountNumber: '1234567890',
    accountHolder: 'CTY TNHH DECOHO',
    branch: 'Chi nhánh TP.HCM',
  };

  @Get('bank-info')
  @ApiOperation({ summary: 'Get DECOHO bank account info for manual transfer' })
  getBankInfo() {
    return this.bankInfo;
  }

  @Post('vnpay/create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create VNPay payment URL' })
  createVNPayPayment(
    @Req() request: AuthRequest,
    @Body() body: { orderId: string; amount: number },
  ) {
    const { orderId, amount } = body;
    const baseUrl = process.env.VNPAY_RETURN_URL ?? 'http://localhost:3000';
    const vnpUrl = process.env.VNPAY_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const vnpTmnCode = process.env.VNPAY_TMN_CODE ?? 'TESTCODE';
    const vnpHashSecret = process.env.VNPAY_HASH_SECRET ?? 'SECRET';
    const vnpApiUrl = process.env.VNPAY_API_URL ?? 'https://sandbox.vnpayment.vn/merchant_webapi/merchant/request';
    
    const orderInfo = `Thanh toan don hang ${orderId}`;
    const createDate = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const expireDate = new Date(Date.now() + 15 * 60 * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
    
    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: vnpTmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'furniture',
      vnp_Amount: String(Math.round(amount * 100)),
      vnp_ReturnUrl: `${baseUrl}/checkout/vnpay-return`,
      vnp_IpAddr: request.ip ?? '127.0.0.1',
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    const sortedKeys = Object.keys(vnpParams).sort();
    const queryString = sortedKeys
      .map((key) => `${key}=${encodeURIComponent(vnpParams[key])}`)
      .join('&');

    const crypto = require('crypto');
    const secureHash = crypto
      .createHmac('sha512', vnpHashSecret)
      .update(queryString)
      .digest('hex');

    const paymentUrl = `${vnpUrl}?${queryString}&vnp_SecureHash=${secureHash}`;

    return { paymentUrl, orderId, amount };
  }

  @Post('momo/create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create MoMo payment URL' })
  async createMoMoPayment(
    @Req() request: AuthRequest,
    @Body() body: { orderId: string; amount: number },
  ) {
    const { orderId, amount } = body;
    const baseUrl = process.env.MOMO_RETURN_URL ?? 'http://localhost:3000';
    const momoEndpoint = process.env.MOMO_ENDPOINT ?? 'https://test-payment.momo.vn/v2/gateway/api/create';
    const momoPartnerCode = process.env.MOMO_PARTNER_CODE ?? 'MOMO';
    const momoAccessKey = process.env.MOMO_ACCESS_KEY ?? 'ACCESS_KEY';
    const momoSecretKey = process.env.MOMO_SECRET_KEY ?? 'SECRET_KEY';

    const orderInfo = `Thanh toan don hang ${orderId}`;
    const requestId = `${Date.now()}`;
    const requestType = 'payWithATM';
    const extraData = '';

    const rawSignature = `accessKey=${momoAccessKey}&amount=${amount}&extraData=${extraData}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${momoPartnerCode}&requestId=${requestId}&requestType=${requestType}`;

    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', momoSecretKey)
      .update(rawSignature)
      .digest('hex');

    const payload = {
      partnerCode: momoPartnerCode,
      partnerCodeName: 'DECOHO',
      storeId: 'DECOHO_STORE',
      requestId,
      amount: String(amount),
      orderId,
      orderInfo,
      redirectUrl: `${baseUrl}/checkout/momo-return`,
      ipnUrl: `${baseUrl}/api/payments/momo-ipn`,
      lang: 'vi',
      items: [],
      requestType,
      extraData,
      signature,
    };

    try {
      const response = await fetch(momoEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return { paymentUrl: data.payUrl ?? data.payurl, orderId, amount };
    } catch {
      return { paymentUrl: `${baseUrl}/checkout?payment=momo&orderId=${orderId}`, orderId, amount };
    }
  }

  @Get('vnpay/return')
  @ApiOperation({ summary: 'VNPay return URL (called by VNPay after payment)' })
  vnpayReturn(@Query() query: Record<string, string>) {
    const { vnp_ResponseCode, vnp_TxnRef, vnp_TransactionNo } = query;
    
    if (vnp_ResponseCode === '00') {
      return {
        success: true,
        message: 'Thanh toan thanh cong',
        orderId: vnp_TxnRef,
        transactionNo: vnp_TransactionNo,
      };
    }
    
    return {
      success: false,
      message: 'Thanh toan that bai hoac bi huy',
      orderId: vnp_TxnRef,
      responseCode: vnp_ResponseCode,
    };
  }

  @Get('momo/return')
  @ApiOperation({ summary: 'MoMo return URL (called by MoMo after payment)' })
  momoReturn(@Query() query: Record<string, string>) {
    const { resultCode, orderId } = query;
    
    if (resultCode === '0') {
      return {
        success: true,
        message: 'Thanh toan thanh cong',
        orderId,
      };
    }
    
    return {
      success: false,
      message: 'Thanh toan that bai hoac bi huy',
      orderId,
      resultCode,
    };
  }
}
