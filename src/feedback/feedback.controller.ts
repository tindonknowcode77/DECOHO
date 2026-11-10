import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackStatus } from './feedback.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';

@ApiTags('Feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Gửi đánh giá hoặc đóng góp ý kiến (cho trang web hoặc sản phẩm)',
  })
  async createFeedback(@Req() req: Request, @Body() dto: CreateFeedbackDto) {
    let authUserId: string | undefined;
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = this.jwtService.decode(token) as {
          sub?: string;
          _id?: string;
          userId?: string;
        };
        authUserId = decoded?.sub || decoded?._id || decoded?.userId;
      } catch {}
    }

    const result = await this.feedbackService.create(dto, authUserId);
    return {
      success: true,
      message: 'Cảm ơn bạn đã gửi đóng góp ý kiến cho DECOHO!',
      data: result,
    };
  }

  @Get('public')
  @ApiOperation({
    summary: 'Lấy danh sách đánh giá & góp ý công khai cho tất cả mọi người cùng xem',
  })
  async getPublicFeedbacks(
    @Query('type') type?: string,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
  ) {
    const data = await this.feedbackService.getPublicFeedbacks({
      type,
      limit,
      page,
    });
    return {
      success: true,
      data,
    };
  }

  @Get('product/:productId')
  @ApiOperation({
    summary: 'Lấy danh sách đánh giá sao và phản hồi của một sản phẩm',
  })
  async getProductFeedback(@Param('productId') productId: string) {
    const data = await this.feedbackService.getProductFeedback(productId);
    return {
      success: true,
      data,
    };
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin: Xem danh sách phản hồi từ người dùng',
  })
  async getAdminFeedback(
    @Query('type') type?: string,
    @Query('rating') rating?: number,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const data = await this.feedbackService.getAdminFeedback({
      type,
      rating,
      productId,
      status,
      page,
      limit,
    });
    return {
      success: true,
      data,
    };
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin: Cập nhật trạng thái phản hồi',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: FeedbackStatus,
  ) {
    const data = await this.feedbackService.updateStatus(id, status);
    return {
      success: true,
      data,
    };
  }
}
