import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoomsService } from '../rooms/rooms.service';
import { AiService, RoomAnalysisResponse } from './ai.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    userId?: string;
    id?: string;
    _id?: string;
  };
};

@ApiTags('AI')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiResponse({ status: 500, description: 'OpenAI Vision analysis failed' })
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly roomsService: RoomsService,
  ) {}

  @Post('rooms/:roomId/analyze')
  @ApiOperation({ summary: 'Analyze an uploaded room image' })
  @ApiParam({ name: 'roomId', description: 'Room id owned by current user' })
  @ApiOkResponse({
    description: 'Room image analysis returned',
    schema: {
      example: {
        roomType: 'Bedroom',
        detectedObjects: ['Bed', 'Desk', 'Lamp'],
        colors: ['White', 'Gray'],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid room id or image URL' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async analyzeUploadedRoom(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<RoomAnalysisResponse> {
    const userId = this.getCurrentUserId(request);
    const room = await this.roomsService.getRoomById(userId, roomId);

    return this.aiService.analyzeRoom(room.imageUrl);
  }

  @Get('rooms/:roomId/objects')
  @ApiOperation({ summary: 'Detect objects from an uploaded room image' })
  @ApiParam({ name: 'roomId', description: 'Room id owned by current user' })
  @ApiOkResponse({
    description: 'Detected objects returned',
    schema: {
      example: ['Bed', 'Desk', 'Lamp'],
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid room id or image URL' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async detectObjects(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<string[]> {
    const userId = this.getCurrentUserId(request);
    const room = await this.roomsService.getRoomById(userId, roomId);

    return this.aiService.detectObjects(room.imageUrl);
  }

  @Get('rooms/:roomId/colors')
  @ApiOperation({ summary: 'Detect dominant colors from an uploaded room image' })
  @ApiParam({ name: 'roomId', description: 'Room id owned by current user' })
  @ApiOkResponse({
    description: 'Detected colors returned',
    schema: {
      example: ['White', 'Gray'],
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid room id or image URL' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async detectColors(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<string[]> {
    const userId = this.getCurrentUserId(request);
    const room = await this.roomsService.getRoomById(userId, roomId);

    return this.aiService.detectColors(room.imageUrl);
  }

  @Get('rooms/:roomId/type')
  @ApiOperation({ summary: 'Classify room type from an uploaded room image' })
  @ApiParam({ name: 'roomId', description: 'Room id owned by current user' })
  @ApiOkResponse({
    description: 'Room type returned',
    schema: {
      example: 'Bedroom',
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid room id or image URL' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async classifyRoomType(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<string> {
    const userId = this.getCurrentUserId(request);
    const room = await this.roomsService.getRoomById(userId, roomId);

    return this.aiService.classifyRoomType(room.imageUrl);
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
