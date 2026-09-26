import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateMoodboardDto } from './dto/create-moodboard.dto';
import {
  AttachMoodboardProductDto,
  UpdateMoodboardDto,
  UpdateMoodboardProductPointDto,
} from './dto/moodboard-products.dto';
import { MoodboardsService } from './moodboards.service';

type AuthedRequest = Request & { user?: { sub?: string } };

@ApiTags('Moodboards')
@Controller('moodboards')
export class MoodboardsController {
  constructor(private readonly service: MoodboardsService) {}

  // ---------------------------------------------------------------------------
  // PUBLIC
  // ---------------------------------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'List public moodboards (featured first)' })
  listPublic() {
    return this.service.listPublic();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết 1 moodboard công khai (tăng view)' })
  detail(@Param('id') id: string) {
    return this.service.getPublicById(id);
  }

  /**
   * TAB PRODUCTS — Lấy danh sách sản phẩm được gắn trong moodboard (dùng cho FE tab "Sản phẩm").
   */
  @Get(':id/products')
  @ApiOperation({ summary: 'Danh sách sản phẩm được ghim trong moodboard' })
  listProducts(@Param('id') id: string) {
    return this.service.getProductsByMoodboardId(id);
  }

  @Get('user/mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Moodboards do user hiện tại tạo' })
  async listMine(@Req() request: AuthedRequest) {
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException('Thiếu user id');
    return this.service.listMine(userId);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'User upload ảnh và tạo moodboard cá nhân' })
  async upload(
    @Req() request: AuthedRequest,
    @Body() dto: CreateMoodboardDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    if (process.env.ENABLE_USER_MOODBOARD_CREATION !== 'true') {
      throw new ForbiddenException('Tính năng tạo moodboard đang tắt');
    }
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException('Thiếu user id');
    if (!image) throw new BadRequestException('Thiếu file ảnh');
    return this.service.createFromUser(userId, dto, image);
  }

  // ---------------------------------------------------------------------------
  // ADMIN
  // ---------------------------------------------------------------------------

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: list tất cả moodboards' })
  listAll() {
    return this.service.listAll();
  }

  @Post('admin/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Admin: upload + tạo moodboard' })
  async adminUpload(
    @Req() request: AuthedRequest,
    @Body() dto: CreateMoodboardDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException('Thiếu user id');
    if (!image) throw new BadRequestException('Thiếu file ảnh');
    return this.service.createFromAdmin(userId, dto, image);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: cập nhật moodboard (featured/visibility/roomType)' })
  update(@Param('id') id: string, @Body() dto: UpdateMoodboardDto) {
    return this.service.updateMoodboard(id, dto);
  }

  @Post('admin/:id/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: ghim sản phẩm vào moodboard' })
  attachProduct(@Param('id') id: string, @Body() dto: AttachMoodboardProductDto) {
    return this.service.attachProduct(id, dto);
  }

  @Patch('admin/:id/products/:pointId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: cập nhật vị trí product point' })
  updatePoint(
    @Param('id') id: string,
    @Param('pointId') pointId: string,
    @Body() dto: UpdateMoodboardProductPointDto,
  ) {
    return this.service.updateProductPoint(id, pointId, dto);
  }

  @Delete('admin/:id/products/:pointId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: gỡ product point khỏi moodboard' })
  removePoint(@Param('id') id: string, @Param('pointId') pointId: string) {
    return this.service.removeProductPoint(id, pointId);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: xoá moodboard + ảnh cloud' })
  async delete(@Param('id') id: string) {
    await this.service.deleteMoodboard(id);
    return { ok: true };
  }
}
