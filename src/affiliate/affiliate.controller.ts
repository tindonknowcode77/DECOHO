import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtService } from '@nestjs/jwt';
import { AffiliateService } from './affiliate.service';
import { AdminAssignOrderDto } from './dto/admin-assign-order.dto';
import { ClaimOrderDto } from './dto/claim-order.dto';
import { GenerateLinkDto } from './dto/generate-link.dto';
import { TrackClickDto } from './dto/track-click.dto';

type AuthedRequest = Request & {
  user?: {
    sub?: string;
    _id?: string;
    userId?: string;
    role?: string;
  };
};

@ApiTags('Shopee Affiliate')
@Controller('affiliate')
export class AffiliateController {
  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Helper: Trích xuất UserId an toàn từ Authed Request
   */
  private extractUserId(req: AuthedRequest): string {
    const id = req.user?.sub || req.user?._id || req.user?.userId;
    if (!id) {
      throw new BadRequestException('Không tìm thấy thông tin xác thực người dùng.');
    }
    return id.toString();
  }

  // ===========================================================================
  // 1. ADMIN: UPLOAD CSV REPORTS (CLICK & COMMISSION)
  // ===========================================================================

  @Post('upload-reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin: Upload file CSV Báo cáo Shopee Affiliate (Click & Hoa hồng)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clickReport: {
          type: 'string',
          format: 'binary',
          description: 'File CSV WebsiteClickReport.csv',
        },
        commissionReport: {
          type: 'string',
          format: 'binary',
          description: 'File CSV AffiliateCommissionReport.csv',
        },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'clickReport', maxCount: 1 },
      { name: 'commissionReport', maxCount: 1 },
    ]),
  )
  async uploadReports(
    @UploadedFiles()
    files: {
      clickReport?: Express.Multer.File[];
      commissionReport?: Express.Multer.File[];
    },
  ) {
    const clickFile = files?.clickReport?.[0];
    const commissionFile = files?.commissionReport?.[0];

    if (!clickFile && !commissionFile) {
      throw new BadRequestException(
        'Vui lòng tải lên ít nhất một file báo cáo (clickReport hoặc commissionReport).',
      );
    }

    const results: any = {};

    if (clickFile) {
      results.clicks = await this.affiliateService.importClickReport(clickFile.buffer);
    }

    if (commissionFile) {
      results.commissions = await this.affiliateService.importCommissionReport(
        commissionFile.buffer,
      );
    }

    return {
      success: true,
      message: 'Xử lý báo cáo Shopee Affiliate thành công.',
      data: results,
    };
  }

  // ===========================================================================
  // 2. USER: TẠO LINK TIẾP THỊ GẮN SUB_ID1
  // ===========================================================================

  @Post('generate-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo link tiếp thị Shopee gắn UserId vào tham số sub_id1',
  })
  generateLink(@Req() req: AuthedRequest, @Body() dto: GenerateLinkDto) {
    const userId = this.extractUserId(req);
    const result = this.affiliateService.generateLink(dto.originalUrl, userId);
    return {
      success: true,
      data: result,
    };
  }

  // ===========================================================================
  // 3. USER: NHẬN ĐƠN HÀNG THỦ CÔNG (CLAIM ORDER)
  // ===========================================================================

  @Post('claim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Người dùng nhập mã đơn hàng Shopee để nhận hoa hồng thủ công',
  })
  async claimOrder(@Req() req: AuthedRequest, @Body() dto: ClaimOrderDto) {
    const userId = this.extractUserId(req);
    const result = await this.affiliateService.claimOrder(userId, dto.orderId);
    return result;
  }

  // ===========================================================================
  // 4. USER: XEM THỐNG KÊ DASHBOARD CỦA MÌNH
  // ===========================================================================

  @Get('my-stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xem thống kê đơn hàng, hoa hồng và lượt click của người dùng hiện tại',
  })
  async getMyStats(@Req() req: AuthedRequest) {
    const userId = this.extractUserId(req);
    const stats = await this.affiliateService.getUserDashboard(userId);
    return {
      success: true,
      data: stats,
    };
  }

  // ===========================================================================
  // 5. ADMIN: XEM TỔNG QUAN TOÀN HỆ THỐNG
  // ===========================================================================

  @Get('admin-overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin: Xem tổng quan toàn bộ chỉ số KPI Shopee Affiliate và đơn hàng mới nhất',
  })
  async getAdminOverview() {
    const overview = await this.affiliateService.getAdminOverview();
    return {
      success: true,
      data: overview,
    };
  }

  // ===========================================================================
  // 6. ADMIN: GÁN ĐƠN HÀNG THỦ CÔNG CHO NGƯỜI DÙNG
  // ===========================================================================

  @Post('admin-assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin: Gán thủ công mã đơn hàng Shopee cho người dùng theo Email hoặc User ID',
  })
  async adminAssignOrder(@Body() dto: AdminAssignOrderDto) {
    return this.affiliateService.adminAssignOrder(dto.orderId, dto.userIdentifier);
  }

  // ===========================================================================
  // 7. GHI NHẬN CLICK MUA SHOPEE TRỰC TIẾP TỪ WEB / MOBILE (LIVE CLICK)
  // ===========================================================================

  @Post('track-click')
  @ApiOperation({
    summary: 'Ghi nhận 1 lượt click mua Shopee từ người dùng (đăng nhập hoặc khách vãng lai)',
  })
  async trackClick(@Req() req: Request, @Body() dto: TrackClickDto) {
    let userId: string | null = null;
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = this.jwtService.decode(token) as {
          sub?: string;
          _id?: string;
          userId?: string;
        };
        userId = decoded?.sub || decoded?._id || decoded?.userId || null;
      } catch {}
    }

    return this.affiliateService.recordLiveClick({
      userId,
      productId: dto.productId,
      productName: dto.productName,
      productLink: dto.productLink,
      source: dto.source || 'web',
      referrer: (req.headers?.referer as string) || '',
    });
  }
}

