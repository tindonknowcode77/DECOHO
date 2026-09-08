import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import multer from 'multer';
import { CallHandler, ExecutionContext, mixin, NestInterceptor } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCommunityCommentDto, CreateCommunityPostDto, ReactCommentDto, ReactPostDto } from './dto/community.dto';
import { CommunityService } from './community.service';

type AuthRequest = Request & { user?: { sub?: string } };
type MulterFile = Express.Multer.File;
type MulterOptions = multer.Options;

/**
 * Custom interceptor — chấp nhận cả field 'files' và 'media'.
 * FE gửi 'files', BE cũ dùng 'media'. Flatten thành array và giới hạn 10 file.
 */

function communityMulterOptions(): MulterOptions {
  return {
    limits: { fileSize: 50 * 1024 * 1024 },
  };
}

export function FlexibleFilesInterceptor() {
  class FlexibleFilesInterceptorHost implements NestInterceptor {
    multerInstance: ReturnType<typeof multer>;

    constructor() {
      this.multerInstance = multer({
        limits: { fileSize: 50 * 1024 * 1024 },
      });
    }

    async intercept(context: ExecutionContext, next: CallHandler) {
      const ctx = context.switchToHttp();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request = ctx.getRequest() as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = ctx.getResponse() as any;

      await new Promise<void>((resolve, reject) => {
        // Single field 'files' — FE đang gửi field này
        const upload = this.multerInstance.array('files', 10);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        upload(request, response, (err: any) => {
          if (err) {
            reject(err);
          } else {
            // multer.array() ghi vào req.files dạng array []
            // Đã đúng định dạng service cần
            resolve();
          }
        });
      });

      return next.handle();
    }
  }

  return mixin(FlexibleFilesInterceptorHost);
}

@ApiTags('Community')
@Controller('community')
export class CommunityController {
  constructor(private readonly service: CommunityService) {}

  @Get('posts')
  posts(
    @Query('tab') tab = 'for-you',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.service.feed(tab, page, Math.min(limit, 30));
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  feed(
    @Req() req: AuthRequest,
    @Query('tab') tab = 'for-you',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.service.feed(tab, page, Math.min(limit, 30), this.user(req));
  }

  @Get('creators')
  creators() {
    return this.service.creators();
  }

  @Get('following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  following(@Req() req: AuthRequest) {
    return this.service.getFollowingIds(this.user(req));
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FlexibleFilesInterceptor())
  create(
    @Req() req: AuthRequest,
    @Body() dto: CreateCommunityPostDto,
  ) {
    const files = (req.files ?? []) as Express.Multer.File[];
    return this.service.create(this.user(req), dto, files);
  }

  @Get('search')
  search(
    @Query('q') q: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Req() req: AuthRequest,
  ) {
    return this.service.search(q, page, Math.min(limit, 30), this.user(req));
  }

  @Get('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getPost(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getById(id, this.user(req));
  }

  @Get('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getComments(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Query('parentId') parentId: string | undefined,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.service.getComments(id, this.user(req), parentId, page, Math.min(limit, 50));
  }

  @Post('posts/:id/react')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  react(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ReactPostDto,
  ) {
    return this.service.react(this.user(req), id, dto.type);
  }

  @Post('posts/:id/comments/:commentId/react')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  reactComment(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() dto: ReactCommentDto,
  ) {
    return this.service.reactComment(this.user(req), id, commentId, dto.type);
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  comment(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: CreateCommunityCommentDto) {
    return this.service.comment(this.user(req), id, dto);
  }

  @Post('posts/:id/comments/:commentId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  likeComment(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.service.toggleCommentLike(this.user(req), id, commentId);
  }

  @Post('users/:id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  follow(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.toggleFollow(this.user(req), id);
  }

  private user(req: AuthRequest) {
    if (!req.user?.sub) throw new UnauthorizedException();
    return req.user.sub;
  }
}
