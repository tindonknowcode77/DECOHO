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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCommunityCommentDto, CreateCommunityPostDto } from './dto/community.dto';
import { CommunityService } from './community.service';

type AuthRequest = Request & { user?: { sub?: string } };
type CommunityFiles = { before?: Express.Multer.File[]; after?: Express.Multer.File[] };

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

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'before', maxCount: 1 },
      { name: 'after', maxCount: 1 },
    ]),
  )
  create(
    @Req() req: AuthRequest,
    @Body() dto: CreateCommunityPostDto,
    @UploadedFiles() files: CommunityFiles,
  ) {
    return this.service.create(this.user(req), dto, files ?? {});
  }

  @Post('posts/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  like(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.toggleLike(this.user(req), id);
  }

  @Post('posts/:id/save')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  save(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.toggleSave(this.user(req), id);
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  comment(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: CreateCommunityCommentDto) {
    return this.service.comment(this.user(req), id, dto);
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
