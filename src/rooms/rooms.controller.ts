import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomsService } from './rooms.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    userId?: string;
    id?: string;
    _id?: string;
  };
};

@ApiTags('Rooms')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiResponse({ status: 500, description: 'Internal server error' })
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload a room image and create a room' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image', 'roomType', 'width', 'length'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
        roomType: {
          type: 'string',
          example: 'living_room',
        },
        width: {
          type: 'number',
          example: 4.5,
        },
        length: {
          type: 'number',
          example: 6.2,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Room uploaded and created' })
  @ApiResponse({ status: 400, description: 'Invalid room upload payload' })
  uploadRoom(
    @Req() request: AuthenticatedRequest,
    @Body() createRoomDto: CreateRoomDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    return this.roomsService.uploadRoom(
      this.getCurrentUserId(request),
      createRoomDto,
      image,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get rooms owned by the authenticated user' })
  @ApiOkResponse({ description: 'Rooms returned' })
  @ApiResponse({ status: 400, description: 'Invalid authenticated user id' })
  getRooms(@Req() request: AuthenticatedRequest) {
    return this.roomsService.getMyRooms(this.getCurrentUserId(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one room owned by the authenticated user' })
  @ApiOkResponse({ description: 'Room returned' })
  @ApiResponse({ status: 400, description: 'Invalid room id' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  getRoomById(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.roomsService.getRoomById(this.getCurrentUserId(request), id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one room owned by the authenticated user' })
  @ApiOkResponse({ description: 'Room deleted' })
  @ApiResponse({ status: 400, description: 'Invalid room id' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async deleteRoom(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ deleted: true }> {
    await this.roomsService.deleteRoom(
      this.getCurrentUserId(request),
      id,
    );

    return { deleted: true };
  }

  private getCurrentUserId(request: AuthenticatedRequest): string {
    const user = request.user;
    const userId = user?.sub ?? user?.userId ?? user?.id ?? user?._id;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user id is missing');
    }

    return userId;
  }
}
